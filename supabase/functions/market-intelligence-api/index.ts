import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
let secretKeys: Record<string,string> = {};
try { secretKeys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); } catch {}
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKeys.default || "";
const db = createClient(SUPABASE_URL, SECRET || "missing", {auth:{persistSession:false, autoRefreshToken:false}});
const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",trimValues:true,parseTagValue:false,processEntities:true,removeNSPrefix:true});
const domains = new Set(["news.google.com","www.federalreserve.gov","www.bls.gov","www.ecb.europa.eu","www.whitehouse.gov"]);
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const reply = (body:unknown,status=200,cache=false) => new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8",...(cache?{"Cache-Control":"public, s-maxage=45, stale-while-revalidate=150"}:{"Cache-Control":"no-store"})}});
const str = (v:any):string => typeof v==="string"?v:(v && typeof v==="object" ? String(v["#text"]||v.__cdata||v["@_href"]||"") : String(v||""));
const clean=(v:any,max=500)=>str(v).replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim().slice(0,max);
const fp=(s:string)=>clean(s,350).replace(/\s+[-–|]\s+[^–|-]+$/,"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
const arr=(x:any):any[]=>!x?[]:Array.isArray(x)?x:[x];
const safeUrl=(value:string)=>{try{const u=new URL(value);return u.protocol==="https:"&&domains.has(u.hostname)}catch{return false}};
function extractLink(item:any):string {
  let link=item?.link;
  if(Array.isArray(link))link=link.find((x:any)=>x?.["@_rel"]==="alternate")||link[0];
  return str(link).trim();
}
function classify(title:string, category:string):{priority:string,reason:string} {
 const t=title.toLowerCase();
 if(/\b(fomc|cpi|nfp|nonfarm|rate decision|rate cut|rate hike|federal reserve decision|emergency|intervention|sanctions|tariffs|war|attack|inflation surprise|jobs report|central bank decision)\b/i.test(t))return {priority:"HOT",reason:"Major macroeconomic or policy development"};
 if(/\b(gold|xauusd|bitcoin|crypto|forex|currency|dollar|yield|oil|inflation|federal reserve|ecb|opec|equities|stocks|treasury)\b/i.test(t) || /Gold|Forex|Crypto|Central Banks|Economic Data/.test(category))return {priority:"WARM",reason:"Market-relevant financial coverage"};
 return {priority:"COLD",reason:"General market context"};
}
function normalize(item:any,source:any){
 const title=clean(item.title,340);
 const original_url=extractLink(item);
 if(!title || title.length<14 || !/^https?:\/\//i.test(original_url))return null;
 const ts=item.pubDate||item.published||item.updated||item["dc:date"];
 const published=new Date(str(ts));
 if(!Number.isFinite(published.getTime()) || published.getTime()<Date.now()-7*86400000 || published.getTime()>Date.now()+900000)return null;
 const fromSource=clean(item.source,90);
 const publisher=fromSource || (title.match(/[-–]\s*([^–-]{3,55})$/)?.[1]||source.name).trim();
 const description=clean(item.description||item.summary||item.content,550);
 const {priority,reason}=classify(title,source.category);
 return {source_id:source.id,title,original_url,publisher,summary:description,published_at:published.toISOString(),category:source.category,priority,priority_reason:reason,fingerprint:fp(title),verification_status:"unverified",is_visible:true};
}
async function authorized(token:string):Promise<boolean>{
 if(!token||!SECRET)return false;
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return false;
 const {data:p}=await db.from("profiles").select("is_admin").eq("id",user.id).maybeSingle();
 return p?.is_admin===true;
}
async function ingestSource(source:any,known:Set<string>):Promise<number>{
 const start=Date.now();let added=0;let err="";
 try{
   if(!safeUrl(source.feed_url))throw new Error("Unsupported feed host");
   const response=await fetch(source.feed_url,{headers:{"User-Agent":"SMShahidShah-MarketIntelligence/1.0 (news feed reader)","Accept":"application/atom+xml, application/rss+xml, application/xml, text/xml"},signal:AbortSignal.timeout(6500),redirect:"follow"});
   if(!response.ok)throw new Error("HTTP "+response.status);
   const xml=await response.text();
   if(xml.length>2500000)throw new Error("Feed exceeds size limit");
   const parsed=parser.parse(xml);
   const feedItems=arr(parsed?.rss?.channel?.item || parsed?.feed?.entry || parsed?.RDF?.item).slice(0,50);
   if(!feedItems.length)throw new Error("Feed returned no readable entries");
   const records:any[]=[];
   for(const item of feedItems) {
      const row=normalize(item,source);
      if(row && !known.has(row.fingerprint)){known.add(row.fingerprint);records.push(row)}
   }
   if(records.length){
      const {error}=await db.from("news_articles").upsert(records,{onConflict:"original_url",ignoreDuplicates:true});
      if(error)throw new Error("Database write: "+error.message.slice(0,200));
      added=records.length;
   }
   await db.from("news_sources").update({last_success_at:new Date().toISOString(),last_error:null,consecutive_failures:0,average_latency_ms:Date.now()-start}).eq("id",source.id);
 }catch(e){
   err=(e instanceof Error?e.message:"Feed failed").slice(0,180);
   await db.from("news_sources").update({last_error:err,consecutive_failures:(source.consecutive_failures||0)+1,average_latency_ms:Date.now()-start}).eq("id",source.id);
 }
 await db.from("news_ingestion_runs").insert({source_id:source.id,started_at:new Date(start).toISOString(),finished_at:new Date().toISOString(),status:err?"error":"success",articles_added:added,error_message:err||null});
 return added;
}
async function refreshOnce():Promise<{started:boolean,added:number,errors:string[]}>{
 if(!SECRET)return {started:false,added:0,errors:["Server database credentials unavailable"]};
 const {data:claimed,error:claimError}=await db.rpc("try_begin_news_ingestion");
 if(claimError||!claimed)return {started:false,added:0,errors:claimError?[claimError.message]:[]};
 let added=0;const errors:string[]=[];
 try{
  const {data:sources,error}=await db.from("news_sources").select("id,name,feed_url,category,polling_minutes,last_success_at,consecutive_failures").eq("enabled",true).limit(30);
  if(error)throw new Error(error.message);
  const eligible=(sources||[]).filter((s:any)=>!s.last_success_at||Date.now()-new Date(s.last_success_at).getTime()>=s.polling_minutes*60000);
  const {data:recent}=await db.from("news_articles").select("fingerprint").gte("first_seen_at",new Date(Date.now()-7*86400000).toISOString()).limit(5000);
  const known=new Set((recent||[]).map((x:any)=>x.fingerprint).filter(Boolean));
  for(let i=0;i<eligible.length;i+=4){
     const group=await Promise.allSettled(eligible.slice(i,i+4).map((src:any)=>ingestSource(src,known)));
     for(const x of group){if(x.status==="fulfilled")added+=x.value;else errors.push(String(x.reason).slice(0,160))}
  }
 }catch(e){errors.push(e instanceof Error?e.message:String(e))}
 finally{
  await db.from("news_ingestion_control").update({last_finished_at:new Date().toISOString(),last_success_count:added}).eq("id",1);
 }
 return {started:true,added,errors};
}
function backgroundRefresh(){
 const task=refreshOnce().catch((e)=>console.error("News refresh error",String(e)));
 try{ (globalThis as any).EdgeRuntime?.waitUntil(task) }catch(e){console.error(e)}
}
async function listNews(url:URL){
 const limit=Math.max(1,Math.min(36,Number(url.searchParams.get("limit")||24)||24));
 const page=Math.max(1,Math.min(30,Number(url.searchParams.get("page")||1)||1));
 let q=db.from("news_articles").select("id,title,summary,publisher,original_url,published_at,category,priority,priority_reason,verification_status").eq("is_visible",true);
 const category=url.searchParams.get("category")||"";
 const priority=url.searchParams.get("priority")||"";
 const search=(url.searchParams.get("q")||"").trim().replace(/[%_,()]/g," ").slice(0,80);
 if(category&&category!=="All")q=q.eq("category",category);
 if(["HOT","WARM","COLD"].includes(priority))q=q.eq("priority",priority);
 if(search)q=q.ilike("title","%"+search+"%");
 const {data,error}=await q.order("published_at",{ascending:false}).range((page-1)*limit,page*limit-1);
 if(error)throw new Error(error.message);
 const {data:state}=await db.from("news_ingestion_control").select("last_started_at,last_finished_at,last_success_count").eq("id",1).maybeSingle();
 return {success:true,items:data||[],page,limit,last_refresh:state?.last_finished_at||null};
}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(!SECRET||!SUPABASE_URL)return reply({success:false,error:"News service is not configured"},503);
 try{
  const url=new URL(req.url);const mode=url.searchParams.get("mode")||"feed";
  if(req.method==="GET"&&(mode==="feed"||mode==="warm")){
    if(mode==="warm"){backgroundRefresh();return reply({success:true,refresh_requested:true},202)}
    const output=await listNews(url);backgroundRefresh();return reply(output,200,true);
  }
  if(req.method==="GET"&&mode==="stats"){
    const {count}=await db.from("news_articles").select("id",{head:true,count:"exact"}).eq("is_visible",true);
    const {data:state}=await db.from("news_ingestion_control").select("last_finished_at,last_success_count").eq("id",1).maybeSingle();
    return reply({success:true,articles:count||0,last_refresh:state?.last_finished_at||null},200,true);
  }
  if(req.method==="POST"){
    const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
    if(!await authorized(token))return reply({success:false,error:"Admin access required"},403);
    const result=await refreshOnce();
    return reply({success:true,...result});
  }
  return reply({success:false,error:"Method not allowed"},405);
 }catch(e){console.error("market-intelligence-api",e);return reply({success:false,error:"Unable to load market news"},500)}
});
