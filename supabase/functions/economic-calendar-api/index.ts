import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const DB_URL=Deno.env.get("SUPABASE_URL")||"";
let keys:Record<string,string>={};try{keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||keys.default||"";
const db=createClient(DB_URL,KEY||"unconfigured",{auth:{persistSession:false,autoRefreshToken:false}});
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const reply=(body:unknown,status=200,cache=false)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json; charset=utf-8","Cache-Control":cache?"public,s-maxage=90,stale-while-revalidate=180":"no-store"}});
const BLS_ICS="https://www.bls.gov/schedule/news_release/bls.ics";
const SOURCE_URL="https://www.bls.gov/schedule/news_release/";
const clean=(x:string,max=200)=>String(x||"").replace(/\\([,;])/g,"$1").replace(/\\n/gi," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max);

function easternToUTC(year:number,month:number,day:number,hour:number,minute:number):Date{
 const provisional=Date.UTC(year,month-1,day,hour,minute);
 const formatter=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",timeZoneName:"shortOffset"});
 const tag=formatter.formatToParts(new Date(provisional)).find(p=>p.type==="timeZoneName")?.value||"GMT-5";
 const match=/GMT([+-])(\d{1,2})(?::(\d\d))?/.exec(tag);
 const offset=match?(match[1]==="-"?-1:1)*(Number(match[2])*60+Number(match[3]||0)):-300;
 return new Date(provisional-offset*60000);
}
function icsTime(raw:string,prop:string):{value:string,precision:"exact"|"date"}|null{
 const str=raw.trim();if(!str)return null;
 const date=/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(?:\d{2})?(Z)?)?$/.exec(str);
 if(!date)return null;
 const [_,yy,mm,dd,hh,mi,utc]=date;
 const y=Number(yy),m=Number(mm),d=Number(dd);
 if(y<2026||y>2030||m<1||m>12||d<1||d>31)return null;
 if(!hh)return {value:new Date(Date.UTC(y,m-1,d)).toISOString(),precision:"date"};
 const time=utc?new Date(Date.UTC(y,m-1,d,Number(hh),Number(mi))):easternToUTC(y,m,d,Number(hh),Number(mi));
 if(!Number.isFinite(time.getTime()))return null;
 // BLS iCalendar times are published in U.S. Eastern; UTC timestamps are also supported.
 return {value:time.toISOString(),precision:"exact"};
}
function classify(summary:string){
 const title=clean(summary,230);
 const tests=[
  [/consumer price index/i,"cpi","Inflation","HIGH","cpi.htm"],
  [/producer price index/i,"ppi","Inflation","HIGH","ppi.htm"],
  [/employment situation/i,"employment","Employment","HIGH","empsit.htm"],
  [/job openings and labor turnover/i,"jolts","Employment","HIGH","jolts.htm"],
  [/employment cost index/i,"eci","Employment","MEDIUM","eci.htm"],
  [/productivity and costs/i,"productivity","Economic Data","MEDIUM","prod2.htm"],
  [/(import and export price|u\.s\. import and export price)/i,"import-export","Economic Data","MEDIUM","ximpim.htm"]
 ] as const;
 for(const [regex,code,category,impact,page] of tests){
  if(regex.test(title))return {title,code,category,impact,source_url:SOURCE_URL+page};
 }
 return null;
}
function parseBlsIcs(ics:string){
 if(!ics.includes("BEGIN:VCALENDAR")||!ics.includes("BEGIN:VEVENT"))throw new Error("Official BLS calendar has no readable events");
 const unfolded=ics.replace(/\r?\n[ \t]/g,"").replace(/\r\n/g,"\n");
 const events=unfolded.split("BEGIN:VEVENT").slice(1);
 const rows:Record<string,unknown>[]=[];
 const seen=new Set<string>();
 const now=Date.now(),min=now-86400000,max=now+370*86400000;
 for(const segment of events.slice(0,900)){
  const content=segment.split("END:VEVENT")[0]||"";
  const fields=content.split("\n").map(s=>s.trim()).filter(Boolean);
  const summary=fields.find(x=>x.startsWith("SUMMARY:"))?.slice(8)||"";
  const dt=fields.find(x=>x.startsWith("DTSTART"));
  const matched=dt?.match(/^DTSTART(?:;[^:]*)?:(.+)$/);
  const parsed=matched?icsTime(matched[1],dt):null;
  const item=classify(summary);
  if(!item||!parsed)continue;
  const ts=Date.parse(parsed.value);
  if(ts<min||ts>max)continue;
  const date=new Date(parsed.value).toISOString().slice(0,10);
  const key="bls:"+item.code+":"+date;
  if(seen.has(key))continue;seen.add(key);
  rows.push({
   source_key:key,title:item.title,country:"US",currency:"USD",
   category:item.category,impact:item.impact,scheduled_at:parsed.value,
   time_precision:parsed.precision,source_name:"U.S. Bureau of Labor Statistics",
   source_url:item.source_url,is_published:true,last_verified_at:new Date().toISOString(),
   status:"scheduled"
  });
 }
 if(!rows.length)throw new Error("Official BLS feed yielded no eligible upcoming events");
 return rows;
}
async function refreshBls(){
 const {data:claimed,error:claimError}=await db.rpc("try_begin_economic_calendar_sync");
 if(claimError)return {started:false,error:"Refresh coordinator unavailable"};
 if(!claimed)return {started:false,error:null};
 let imported=0,error="";
 try{
  const response=await fetch(BLS_ICS,{
   headers:{"User-Agent":"SMShahidShah-EconomicCalendar/1.0","Accept":"text/calendar, text/plain"},
   signal:AbortSignal.timeout(12000),redirect:"follow"
  });
  if(!response.ok||new URL(response.url).hostname!=="www.bls.gov")throw new Error("BLS calendar unavailable (HTTP "+response.status+")");
  if(Number(response.headers.get("content-length")||0)>1500000)throw new Error("BLS calendar too large");
  const raw=await response.text();if(raw.length>1500000)throw new Error("BLS calendar too large");
  const rows=parseBlsIcs(raw);
  const result=await db.from("economic_calendar_events").upsert(rows,{onConflict:"source_key"}).select("id");
  if(result.error)throw new Error("Calendar database update failed");
  imported=result.data?.length||0;
 }catch(e){
  error=e instanceof Error?e.message.slice(0,160):"Calendar feed temporarily unavailable";
  console.error("BLS sync: ",error);
 }finally{
  await db.from("economic_calendar_sync_control").update({
   lease_expires_at:null,last_completed_at:new Date().toISOString(),
   ...(error?{last_error:error}:{last_error:null,last_success_at:new Date().toISOString(),last_imported:imported})
  }).eq("id",1);
 }
 return {started:true,imported,error:error||null};
}
function backgroundSync(){
 if(!KEY||!DB_URL)return;
 const task=refreshBls().catch(e=>console.error("Calendar refresh failed",String(e)));
 try{(globalThis as any).EdgeRuntime?.waitUntil(task)}catch(e){console.error("Calendar background scheduling unavailable")}
}
async function authorizeAdmin(req:Request){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return false;
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return false;
 const {data:profile}=await db.from("profiles").select("is_admin").eq("id",user.id).maybeSingle();
 return profile?.is_admin===true;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(!DB_URL||!KEY)return reply({success:false,error:"Calendar service not configured"},503);
 const url=new URL(req.url);
 try{
  if(req.method==="GET"){
   const mode=url.searchParams.get("mode")||"events";
   if(mode==="warm"){
    backgroundSync();
    return reply({success:true,refresh_requested:true},202);
   }
   if(mode!=="events")return reply({success:false,error:"Unknown calendar mode"},400);
   const startParam=url.searchParams.get("from");
   const endParam=url.searchParams.get("to");
   const start=startParam&&/^\d{4}-\d{2}-\d{2}$/.test(startParam)?new Date(startParam+"T00:00:00Z"):new Date(Date.now()-86400000);
   const end=endParam&&/^\d{4}-\d{2}-\d{2}$/.test(endParam)?new Date(endParam+"T23:59:59Z"):new Date(Date.now()+90*86400000);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end.getTime()-start.getTime()>366*86400000||end<start)return reply({success:false,error:"Invalid date range"},400);
   let query=db.from("economic_calendar_events").select("id,title,country,currency,category,impact,scheduled_at,time_precision,actual,forecast,previous,status,source_name,source_url,last_verified_at")
    .eq("is_published",true).not("last_verified_at","is",null).gte("scheduled_at",start.toISOString()).lte("scheduled_at",end.toISOString());
   const impact=(url.searchParams.get("impact")||"").toUpperCase(),currency=(url.searchParams.get("currency")||"").toUpperCase();
   if(["HIGH","MEDIUM","LOW"].includes(impact))query=query.eq("impact",impact);
   if(/^[A-Z]{3}$/.test(currency))query=query.eq("currency",currency);
   const {data,error}=await query.order("scheduled_at",{ascending:true}).limit(150);
   if(error)throw new Error("Calendar query failed");
   const {data:sync}=await db.from("economic_calendar_sync_control").select("last_success_at,last_completed_at,last_error").eq("id",1).maybeSingle();
   return reply({success:true,items:data||[],last_source_sync:sync?.last_success_at||null,last_sync_attempt:sync?.last_completed_at||null,
    source_status:sync?.last_success_at?"connected":"official_schedule_seeded",note:"Scheduled dates are attributed. Actual, forecast and previous are shown only when verified."},200,true);
  }
  if(req.method==="POST"){
   if(!await authorizeAdmin(req))return reply({success:false,error:"Admin access required"},403);
   const body=await req.json().catch(()=>({}));
   if(body?.action!=="sync-bls")return reply({success:false,error:"Unsupported action"},400);
   const result=await refreshBls();
   return reply({success:!result.error,...result},result.error?502:200);
  }
  return reply({success:false,error:"Method not allowed"},405);
 }catch(e){console.error("economic-calendar-api",e instanceof Error?e.message:String(e));return reply({success:false,error:"Calendar is temporarily unavailable"},500)}
});
