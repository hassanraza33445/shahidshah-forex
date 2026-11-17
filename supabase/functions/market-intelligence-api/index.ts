import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
let secretKeys: Record<string,string> = {};
try { secretKeys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); } catch {}
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKeys.default || "";
const db = createClient(SUPABASE_URL, SECRET || "missing", {auth:{persistSession:false, autoRefreshToken:false}});
const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@_",textNodeName:"#text",trimValues:true,parseTagValue:false,processEntities:true,removeNSPrefix:true});
const domains = new Set(["news.google.com","www.federalreserve.gov","www.bls.gov","www.ecb.europa.eu","www.whitehouse.gov","www.eia.gov"]);
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
// Fetches only pre-approved RSS hosts; never follows a redirect to an unapproved domain.
async function fetchSourceXML(url:string):Promise<string>{
 let last:unknown=null;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const r=await fetch(url,{headers:{"User-Agent":"SMShahidShah-MarketIntelligence/2.0 (RSS reader)","Accept":"application/rss+xml,application/atom+xml,application/xml,text/xml"},signal:AbortSignal.timeout(7000),redirect:"follow"});
   if(!safeUrl(r.url))throw new Error("RSS redirected to an unapproved host");
   if(!r.ok){
    const e=new Error("RSS HTTP "+r.status);
    if((r.status===429||r.status>=500)&&attempt===0){last=e;await new Promise(ok=>setTimeout(ok,400));continue}
    throw e;
   }
   if(Number(r.headers.get("content-length")||0)>2500000)throw new Error("RSS feed too large");
   const text=await r.text();if(text.length>2500000)throw new Error("RSS feed too large");
   return text;
  }catch(e){
   last=e;
   const transient=e instanceof Error&&(e.name==="TimeoutError"||e.name==="AbortError"||e.message==="RSS HTTP 429"||e.message.startsWith("RSS HTTP 5"));
   if(!transient||attempt===1)break;
   await new Promise(ok=>setTimeout(ok,400));
  }
 }
 throw last instanceof Error?last:new Error("RSS unavailable");
}
async function ingestSource(source:any):Promise<{added:number,error:string}>{
 const start=Date.now();let added=0,err="";
 try{
  if(!safeUrl(source.feed_url))throw new Error("Unsupported feed host");
  const xml=await fetchSourceXML(source.feed_url);
  const parsed=parser.parse(xml);
  const items=arr(parsed?.rss?.channel?.item||parsed?.feed?.entry||parsed?.RDF?.item).slice(0,50);
  if(!items.length)throw new Error("Feed returned no readable entries");
  const rows:any[]=[],seen=new Set<string>();
  for(const item of items){
   const row=normalize(item,source);
   if(row&&!seen.has(row.original_url)){rows.push(row);seen.add(row.original_url)}
  }
  if(rows.length){
   // Preserve independently sourced reports, dedupe by URL; actual inserted count only.
   const {data,error}=await db.from("news_articles").upsert(rows,{onConflict:"original_url",ignoreDuplicates:true}).select("id");
   if(error)throw new Error("Database write: "+error.message.slice(0,150));
   added=(data||[]).length;
  }
  const {error:health}=await db.from("news_sources").update({
   last_success_at:new Date().toISOString(),last_attempt_at:new Date().toISOString(),
   next_retry_at:null,last_error:null,consecutive_failures:0,average_latency_ms:Date.now()-start
  }).eq("id",source.id);
  if(health)throw new Error("Source health update: "+health.message.slice(0,110));
 }catch(e){
  err=(e instanceof Error?e.message:"Feed failed").slice(0,180);
  const failures=Math.min(7,(Number(source.consecutive_failures)||0)+1);
  const poll=Math.max(1,Math.min(120,Number(source.polling_minutes)||5));
  const retryMinutes=Math.max(poll,Math.min(60,2**failures));
  await db.from("news_sources").update({
   last_error:err,consecutive_failures:failures,last_attempt_at:new Date().toISOString(),
   next_retry_at:new Date(Date.now()+retryMinutes*60000).toISOString(),average_latency_ms:Date.now()-start
  }).eq("id",source.id);
 }
 await db.from("news_ingestion_runs").insert({
  source_id:source.id,started_at:new Date(start).toISOString(),finished_at:new Date().toISOString(),
  status:err?"error":"success",articles_added:added,error_message:err||null
 });
 return {added,error:err};
}
async function refreshOnce():Promise<{started:boolean,added:number,errors:string[]}>{
 if(!SECRET)return {started:false,added:0,errors:["Server database credentials unavailable"]};
 const {data:claimed,error:claimError}=await db.rpc("try_begin_news_ingestion");
 if(claimError||!claimed)return {started:false,added:0,errors:claimError?[claimError.message]:[]};
 let added=0;const errors:string[]=[];
 try{
  const {data:sources,error}=await db.from("news_sources").select("id,name,feed_url,category,polling_minutes,last_success_at,last_attempt_at,next_retry_at,consecutive_failures").eq("enabled",true).limit(80);
  if(error)throw new Error(error.message);
  const now=Date.now();
  const eligible=(sources||[]).filter((src:any)=>{
   const retry=src.next_retry_at?Date.parse(src.next_retry_at):0;
   if(retry&&retry>now)return false;
   const last=src.last_attempt_at||src.last_success_at;
   const elapsed=last?now-Date.parse(last):Number.POSITIVE_INFINITY;
   return elapsed>=Math.max(1,Math.min(120,Number(src.polling_minutes)||5))*60000;
  });
  for(let i=0;i<eligible.length;i+=4){
   const group=await Promise.allSettled(eligible.slice(i,i+4).map((src:any)=>ingestSource(src)));
   for(const result of group){
    if(result.status==="fulfilled"){added+=result.value.added;if(result.value.error)errors.push(result.value.error)}
    else errors.push(String(result.reason).slice(0,160));
   }
  }
  const {error:clusterError}=await db.rpc("refresh_news_story_clusters");
  if(clusterError)errors.push("Story grouping unavailable");
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
 const category=(url.searchParams.get("category")||"").slice(0,80);
 const requestedPriority=(url.searchParams.get("priority")||url.searchParams.get("heat")||"").toUpperCase();
 const priority=["HOT","WARM","COLD"].includes(requestedPriority)?requestedPriority:"";
 const search=(url.searchParams.get("q")||"").trim().replace(/[%_,()]/g," ").slice(0,80);
 const {data,error}=await db.rpc("market_news_feed_v2",{
  p_category:category&&category!=="All"?category:null,
  p_priority:priority||null,p_search:search||null,p_limit:limit,p_offset:(page-1)*limit
 });
 let rows:any[]=data||[];
 if(error){
  // Safe fallback to existing feed if the V2 SQL RPC is temporarily unavailable.
  console.error("V2 feed fallback",error.message.slice(0,120));
  let q=db.from("news_articles").select("id,title,summary,publisher,original_url,published_at,category,priority,priority_reason,verification_status").eq("is_visible",true);
  if(category&&category!=="All")q=q.eq("category",category);
  if(priority)q=q.eq("priority",priority);
  if(search)q=q.ilike("title","%"+search+"%");
  const fallback=await q.order("published_at",{ascending:false}).range((page-1)*limit,page*limit-1);
  if(fallback.error)throw new Error(fallback.error.message);
  rows=fallback.data||[];
 }
 const {data:control}=await db.from("news_ingestion_control").select("last_finished_at").eq("id",1).maybeSingle();
 return {success:true,items:rows,page,limit,last_refresh:control?.last_finished_at||null,grouping:error?"legacy":"strict_headline"};
}

/* Homepage-focused feed: balanced, real Gold + Forex + general headlines.
   Each article comes from the same deduplicated, source-linked database RPC.
   No invented stories, synthetic timestamps or duplicated clusters. */
async function listBalancedNews(url:URL){
 // Larger topic-focused pool; the final display order is ALWAYS newest-first.
 const maxItems=Math.max(12,Math.min(120,Number(url.searchParams.get("limit")||120)||120));
 const specs:[string|null,number][]=[
  ["Gold",0],["Gold",36],["Forex",0],["Forex",36],[null,0],[null,36]
 ];
 const result=await Promise.allSettled(specs.map(([category,offset])=>
  db.rpc("market_news_feed_v2",{
   p_category:category,p_priority:null,p_search:null,p_limit:36,p_offset:offset
  })
 ));
 const groups:[any[],any[],any[]]=[[],[],[]];
 for(let i=0;i<result.length;i++){
  const r=result[i];
  if(r.status==="fulfilled"&&!r.value.error&&Array.isArray(r.value.data))
   groups[i<2?0:i<4?1:2].push(...r.value.data);
 }
 if(groups.every(x=>x.length===0))return listNews(url);
 const cutoff=Date.now()-72*60*60*1000;
 const fresh=(rows:any[])=>rows.filter(x=>{
  const ts=Date.parse(String(x.published_at||""));
  return Number.isFinite(ts)&&ts>=cutoff&&ts<=Date.now()+15*60*1000;
 });
 const gold=fresh(groups[0]),forex=fresh(groups[1]),other=fresh(groups[2]);
 const seenClusters=new Set<string>(),seenTitles=new Set<string>(),seenIds=new Set<string>(),output:any[]=[];
 const push=(item:any)=>{
  if(!item||output.length>=maxItems)return false;
  const id=String(item.id||"").trim();
  const cluster=String(item.cluster_id||"").trim();
  const title=clean(item.title,300).toLowerCase()
   .replace(/\s+[-–|]\s+[^–|-]+$/,"").replace(/[^a-z0-9]+/g," ").trim();
  if(seenIds.has(id)||cluster&&seenClusters.has(cluster)||title&&seenTitles.has(title))return false;
  if(id)seenIds.add(id);
  if(cluster)seenClusters.add(cluster);
  if(title)seenTitles.add(title);
  output.push(item);
  return true;
 };
 // Fill from genuine Gold/Forex sources first without fabricating headlines.
 let gi=0,fi=0,oi=0;
 const take=(rows:any[],kind:"gold"|"forex"|"other")=>{
  while(output.length<maxItems){
   const next=kind==="gold"?gi++:kind==="forex"?fi++:oi++;
   if(next>=rows.length)return;
   if(push(rows[next]))return;
  }
 };
 for(let i=0;i<80&&output.length<maxItems;i++){
  const before=output.length;
  take(gold,"gold");take(forex,"forex");take(gold,"gold");take(forex,"forex");take(other,"other");
  if(before===output.length)break;
 }
 for(const item of [...gold,...forex,...other]){
  if(output.length>=maxItems)break;
  push(item);
 }
 // Critical invariant: latest published headline is always at the top.
 output.sort((a,b)=>{
  const delta=Date.parse(String(b.published_at||""))-Date.parse(String(a.published_at||""));
  return delta||String(b.id||"").localeCompare(String(a.id||""));
 });
 const {data:control}=await db.from("news_ingestion_control")
  .select("last_finished_at").eq("id",1).maybeSingle();
 return {success:true,items:output,page:1,limit:maxItems,
  last_refresh:control?.last_finished_at||null,
  grouping:"deduplicated_gold_forex_latest",order:"newest_first"};
}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(!SECRET||!SUPABASE_URL)return reply({success:false,error:"News service is not configured"},503);
 try{
  const url=new URL(req.url);const mode=url.searchParams.get("mode")||"feed";
  if(req.method==="GET"&&(mode==="feed"||mode==="warm")){
    if(mode==="warm"){backgroundRefresh();return reply({success:true,refresh_requested:true},202)}
    const output=mode==="feed"&&url.searchParams.get("focus")==="gold-forex"?await listBalancedNews(url):await listNews(url);backgroundRefresh();return reply(output,200,true);
  }
  if(req.method==="GET"&&mode==="health"){
    const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
    if(!await authorized(token))return reply({success:false,error:"Admin access required"},403);
    const {data:sources,error:sourceError}=await db.from("news_sources").select("id,name,category,enabled,polling_minutes,priority_weight,last_success_at,last_attempt_at,next_retry_at,consecutive_failures,last_error,average_latency_ms").order("priority_weight",{ascending:false}).limit(150);
    if(sourceError)throw new Error("Source health unavailable");
    const {data:control}=await db.from("news_ingestion_control").select("last_started_at,last_finished_at,last_success_count").eq("id",1).maybeSingle();
    const now=Date.now();
    const records=(sources||[]).map((s:any)=>{
      const last=s.last_success_at?Date.parse(s.last_success_at):0;
      const healthy=s.enabled&&!s.last_error&&last>0&&now-last<Math.max(20,Number(s.polling_minutes||5)*3)*60000;
      return {...s,health_status:!s.enabled?"disabled":healthy?"healthy":s.last_error?"error":"stale"};
    });
    return reply({success:true,sources:records,source_count:records.length,
      enabled_count:records.filter(s=>s.enabled).length,
      healthy_count:records.filter(s=>s.health_status==="healthy").length,
      failed_count:records.filter(s=>s.health_status==="error").length,
      last_refresh:control?.last_finished_at||null,last_added:control?.last_success_count||0},200,false);
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
