// Mirror ONLY the public headlines PipSePaisa has ALREADY sent as HOT push.
// This sync does not reuse its subscribers, push credentials or personal data.
// Dispatch remains handled by the site's existing opt-in OneSignal queue.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
const DB=Deno.env.get("SUPABASE_URL")||"";
let keys:Record<string,string>={};
try{keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||keys.default||"";
const MIRROR="https://etfolhinohgmskbfjoyh.supabase.co/functions/v1/psp-hot-news-mirror-feed";
const db=createClient(DB,SECRET||"unconfigured",{auth:{persistSession:false,autoRefreshToken:false}});
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
const clean=(value:unknown,max:number)=>String(value??"").replace(/[\u0000-\u001f<>]+/g," ").replace(/\s+/g," ").trim().slice(0,max);
function topicFor(title:string):string{
 const t=title.toLowerCase();
 if(/\b(bitcoin|crypto|ethereum|dogecoin|xrp|btc|eth)\b/.test(t))return "Crypto";
 if(/\b(gold|silver|bullion|xauusd|precious metals|comex)\b/.test(t))return "Gold";
 if(/\b(oil|brent|opec|tanker|crude|wti|hormuz)\b/.test(t))return "Energy";
 if(/\b(forex|fx|eur\/usd|gbp\/usd|usd\/jpy|dxy|currency|currencies|yen|dollar|pound|euro)\b/.test(t))return "Forex";
 if(/\b(fomc|fed|federal reserve|central bank|ecb|boj|boe|powell|rate hike|rate cut)\b/.test(t))return "Central Banks";
 if(/\b(cpi|ppi|nfp|inflation|employment|payroll|gdp|pce|retail sales)\b/.test(t))return "Economic Data";
 return "Geopolitics";
}
async function digest(value:string){
 const data=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,"0")).join("");
}
function safeArticleUrl(value:string){
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&!u.username&&!u.password&&!!u.hostname&&u.href.length<=1800;
 }catch{return false}
}
async function sync(){
 const resp=await fetch(MIRROR,{method:"GET",cache:"no-store",
  headers:{"Accept":"application/json"},signal:AbortSignal.timeout(12000)});
 if(!resp.ok)throw Error("PipSePaisa public HOT mirror is unavailable");
 const payload=await resp.json();
 if(payload?.success!==true||!Array.isArray(payload.items))throw Error("Invalid HOT mirror response");
 const now=Date.now();let matched=0,created=0,duplicate=0,skipped=0,failed=0;
 for(const raw of payload.items.slice(0,36)){
  const headline=clean(raw.headline,240),source=clean(raw.source||"Publisher",100);
  const articleUrl=clean(raw.article_url,1800);
  const sentTime=Date.parse(String(raw.sent_at||""));
  const publishedTime=Date.parse(String(raw.published_at||""));
  // The original worker has already authenticated its sent log. Only mirror
  // newly dispatched, timely alerts to avoid sending old backfill notifications.
  if(!headline||headline.length<10||!source||!safeArticleUrl(articleUrl)||
   !Number.isFinite(sentTime)||!Number.isFinite(publishedTime)||
   sentTime>now+60000||now-sentTime>10*60000||
   publishedTime>now+60000||now-publishedTime>45*60000){skipped++;continue}
  matched++;
  try{
   let {data:article,error:lookupError}=await db.from("news_articles")
    .select("id,category").eq("original_url",articleUrl).maybeSingle();
   if(lookupError)throw Error("Source article lookup failed");
   if(!article){
    // Preserve the exact same publisher URL/headline even if PipSePaisa
    // discovered it before S M Shahid Shah's separate RSS polling did.
    const {error:writeError}=await db.from("news_articles").upsert({
     title:headline,summary:"Published source-linked market headline.",
     publisher:source,original_url:articleUrl,
     published_at:new Date(publishedTime).toISOString(),
     category:topicFor(headline),priority:"HOT",
     priority_reason:"Previously sent as PipSePaisa HOT news",
     verification_status:"unverified",is_visible:true,
     fingerprint:"psp-"+(await digest(headline)).slice(0,45)
    },{onConflict:"original_url",ignoreDuplicates:true});
    if(writeError)throw Error("Unable to save source-linked article");
    const result=await db.from("news_articles")
     .select("id,category").eq("original_url",articleUrl).maybeSingle();
    if(result.error||!result.data)throw Error("Mirrored source article missing");
    article=result.data;
   }
   const category=["Gold","Forex","Crypto","Central Banks","Economic Data","Energy","Geopolitics"].includes(article.category)?
    article.category:topicFor(headline);
   const {data:record,error}=await db.from("market_notification_events").upsert({
    dedupe_key:"pip-hot:"+(await digest(articleUrl)),
    kind:"breaking_news",title:headline,
    body:clean("Publisher: "+source+". Source-linked HOT news; not independently fact-checked.",600),
    topic:category,impact:"HOT",trust_status:"unverified",
    target_url:articleUrl,source_article_id:article.id,is_active:true,
    created_at:new Date(sentTime).toISOString(),
    expires_at:new Date(sentTime+30*60000).toISOString()
   },{onConflict:"dedupe_key",ignoreDuplicates:true}).select("id");
   if(error)throw Error("Unable to record mirrored HOT notice");
   if((record||[]).length)created++;else duplicate++;
  }catch(e){failed++;console.error("HOT mirror item skipped",e instanceof Error?e.message:"unknown")}
 }
 return {success:true,observed:payload.items.length,matched,created,duplicate,skipped,failed};
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply({success:false,error:"Method not allowed"},405);
 const {data:config,error}=await db.from("market_push_runtime")
  .select("dispatch_enabled,run_token").eq("id",true).maybeSingle();
 if(error||!config)return reply({success:false,error:"Mirror runtime unavailable"},503);
 const provided=String(req.headers.get("x-dispatch-key")||"");
 const authorizedByCron=provided.length>=36&&provided===String(config.run_token);
 const authorizedByService=SECRET.length>30&&req.headers.get("authorization")==="Bearer "+SECRET;
 if(!authorizedByCron&&!authorizedByService)return reply({success:false,error:"Unauthorized"},403);
 if(config.dispatch_enabled!==true)return reply({success:false,error:"Push disabled"},503);
 try{return reply(await sync());}
 catch(e){
  console.error("Pip HOT mirror unavailable",e instanceof Error?e.message:"unknown");
  return reply({success:false,error:"Hot alert mirror temporarily unavailable"},503);
 }
});
