import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
let secrets:Record<string,string>={};try{secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||secrets.default||"";
const PROVIDER_KEY=Deno.env.get("TWELVEDATA_API_KEY")||"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE||"unconfigured",{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const respond=(body:unknown,status=200,cache=false)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,"Content-Type":"application/json; charset=utf-8",
 "Cache-Control":cache?"public,s-maxage=60,stale-while-revalidate=120":"no-store"}
});
const SYMBOLS:Record<string,{provider:string,pip:number|null,unit:string}>={
 XAUUSD:{provider:"XAU/USD",pip:null,unit:"USD per oz"},
 EURUSD:{provider:"EUR/USD",pip:0.0001,unit:"USD"},
 GBPUSD:{provider:"GBP/USD",pip:0.0001,unit:"USD"},
 USDJPY:{provider:"USD/JPY",pip:0.01,unit:"JPY"},
 BTCUSD:{provider:"BTC/USD",pip:null,unit:"USD"}
};
const HORIZONS=[5,15,30,60] as const;
const DOCS_URL="https://twelvedata.com/docs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rounded=(v:number,places:number)=>Number(v.toFixed(places));
const isoMinute=(ms:number)=>new Date(Math.floor(ms/60000)*60000).toISOString();
type PriceCandle={bar_open:string,open_price:number,high_price:number,low_price:number,close_price:number};
const safeNumber=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:null};
function parsePrices(payload:any,from:number,to:number):PriceCandle[]{
 if(!payload||!Array.isArray(payload.values))throw new Error("No 1-minute candles returned by provider");
 const timezone=String(payload.meta?.timezone||"UTC");
 if(!["UTC","Etc/UTC","GMT"].includes(timezone))throw new Error("Provider did not confirm UTC timestamps");
 if(payload.meta?.interval&&payload.meta.interval!=="1min")throw new Error("Provider returned the wrong interval");
 const candles:PriceCandle[]=[],seen=new Set<number>();
 for(const row of payload.values.slice(0,120)){
  const raw=String(row.datetime||"");
  // The provider's requested timezone is UTC; parse a timezone-naive timestamp as UTC.
  if(!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?$/.test(raw))continue;
  const ts=Date.parse(raw.replace(" ","T")+"Z");
  if(!Number.isFinite(ts)||ts%60000!==0||ts<from||ts>to||seen.has(ts))continue;
  const open=safeNumber(row.open),high=safeNumber(row.high),
   low=safeNumber(row.low),close=safeNumber(row.close);
  if(open===null||high===null||low===null||close===null)continue;
  if(high<Math.max(open,low,close)||low>Math.min(open,high,close))continue;
  seen.add(ts);candles.push({
   bar_open:new Date(ts).toISOString(),open_price:open,high_price:high,
   low_price:low,close_price:close
  });
 }
 return candles.sort((a,b)=>Date.parse(a.bar_open)-Date.parse(b.bar_open));
}
async function requestPrices(symbol:string,eventTime:number):Promise<PriceCandle[]>{
 const from=eventTime-3*60000,to=eventTime+61*60000;
 const params=new URLSearchParams({
  symbol:SYMBOLS[symbol].provider,interval:"1min",timezone:"UTC",
  start_date:new Date(from).toISOString().slice(0,19),
  end_date:new Date(to).toISOString().slice(0,19),format:"JSON",apikey:PROVIDER_KEY
 });
 // The provider key is transmitted only server-side, never in public HTML/response/logs.
 const response=await fetch("https://api.twelvedata.com/time_series?"+params,{
  method:"GET",signal:AbortSignal.timeout(12000),redirect:"error",
  headers:{"Accept":"application/json"}
 });
 if(!response.ok)throw new Error("Historical price provider HTTP "+response.status);
 if(Number(response.headers.get("content-length")||0)>250000)throw new Error("Historical price response too large");
 const raw=await response.text();
 if(raw.length>250000)throw new Error("Historical price response too large");
 const json=JSON.parse(raw);
 if(json?.status==="error"||json?.code)throw new Error("Historical provider rejected the request");
 return parsePrices(json,from,to);
}
function calculate(eventTime:number,symbol:string,items:PriceCandle[]){
 if(eventTime%60000!==0)throw new Error("Event does not have minute-precision UTC time");
 const byTime=new Map(items.map(x=>[Date.parse(x.bar_open),x]));
 // Baseline: last FULLY CLOSED one-minute candle before event.
 const baselineAt=eventTime-60000,baseline=byTime.get(baselineAt);
 const rows:Record<string,unknown>[]=[];
 const missing:number[]=[];
 for(const horizon of HORIZONS){
  // At +H minutes, use the one-minute candle that closes exactly at T+H.
  const targetAt=eventTime+(horizon-1)*60000,target=byTime.get(targetAt);
  if(!baseline||!target){missing.push(horizon);continue}
  const delta=target.close_price-baseline.close_price;
  const pips=SYMBOLS[symbol].pip===null?null:rounded(delta/SYMBOLS[symbol].pip!,4);
  rows.push({
   symbol,provider:"twelve_data",horizon_minutes:horizon,
   baseline_bar_open:isoMinute(baselineAt),target_bar_open:isoMinute(targetAt),
   baseline_close:baseline.close_price,target_close:target.close_price,
   move_absolute:rounded(delta,10),move_percent:rounded(delta/baseline.close_price*100,8),
   fx_pips:pips,provider_source_url:DOCS_URL
  });
 }
 return {rows,missing,hasBaseline:!!baseline};
}
async function admin(req:Request){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token||token===SERVICE_ROLE)return false;
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return false;
 const {data:profile}=await db.from("profiles").select("is_admin").eq("id",user.id).maybeSingle();
 return profile?.is_admin===true;
}
async function publicList(url:URL){
 const limit=Math.max(1,Math.min(30,Number(url.searchParams.get("limit")||18)||18));
 const eventId=(url.searchParams.get("event_id")||"").trim();
 const symbol=(url.searchParams.get("symbol")||"").trim().toUpperCase();
 if(eventId&&!uuid.test(eventId))return {error:"Invalid event identifier"};
 if(symbol&&!SYMBOLS[symbol])return {error:"Unsupported market symbol"};
 let q=db.from("economic_calendar_events")
  .select("id,title,category,impact,currency,scheduled_at,time_precision,source_name,source_url")
  .eq("is_published",true).not("last_verified_at","is",null)
  .eq("time_precision","exact")
  .gte("scheduled_at",new Date(Date.now()-90*86400000).toISOString())
  .lt("scheduled_at",new Date().toISOString());
 if(eventId)q=q.eq("id",eventId);
 const {data:events,error:eventsError}=await q.order("scheduled_at",{ascending:false}).limit(limit);
 if(eventsError)throw new Error("Verified calendar unavailable");
 const eventIds=(events||[]).map(e=>e.id);
 let reactions:any[]=[];
 if(eventIds.length){
  let rq=db.from("market_event_reactions")
   .select("event_id,symbol,horizon_minutes,baseline_bar_open,target_bar_open,baseline_close,target_close,move_absolute,move_percent,fx_pips,provider,provider_source_url,observed_at")
   .in("event_id",eventIds).eq("is_published",true)
   .not("reviewed_at","is",null).not("license_confirmed_at","is",null)
   .order("horizon_minutes",{ascending:true});
  if(symbol)rq=rq.eq("symbol",symbol);
  const {data,error}=await rq;
  if(error)throw new Error("Market reaction history unavailable");
  reactions=data||[];
 }
 const grouped=new Map<string,any[]>();
 for(const r of reactions){
  const group=grouped.get(r.event_id)||[];
  group.push(r);grouped.set(r.event_id,group);
 }
 const items=(events||[]).map(e=>({
  ...e,observations:grouped.get(e.id)||[],
  status:(grouped.get(e.id)||[]).length?"verified_observations":"awaiting_verified_price_data"
 }));
 return {success:true,items,
  supported_symbols:Object.keys(SYMBOLS),
  horizons_minutes:HORIZONS,
  methodology:"Last 1-minute candle closing at event T versus candle closing at T+5/15/30/60 minutes; no interpolation.",
  data_policy:"Results displayed only after provider-backed prices, administrator review and licensed redistribution confirmation.",
  provider_integration:PROVIDER_KEY?"configured":"awaiting_secure_api_key",
  source_provider:"Twelve Data (optional integration)"
 };
}
async function writeLog(eventId:string,symbol:string,result:string,candleCount:number,horizonCount:number,detail:string){
 const {error}=await db.from("market_reaction_sync_logs").insert({
  event_id:eventId,symbol,provider:"twelve_data",result,
  candle_count:candleCount,horizon_count:horizonCount,detail:detail.slice(0,180)
 });
 if(error)console.error("Market reaction audit log unavailable");
}
async function sync(eventId:string,symbol:string,force:boolean){
 const {data:event,error}=await db.from("economic_calendar_events")
  .select("id,title,scheduled_at,is_published,last_verified_at,time_precision")
  .eq("id",eventId).maybeSingle();
 if(error||!event||!event.is_published||!event.last_verified_at)
  return {success:false,http:404,error:"Verified economic event not found"};
 if(event.time_precision!=="exact")return {success:false,http:422,error:"An exact event timestamp is required"};
 const eventTime=Date.parse(event.scheduled_at),age=Date.now()-eventTime;
 if(!Number.isFinite(eventTime)||eventTime%60000!==0||age<65*60000||age>90*86400000)
  return {success:false,http:422,error:"Event must be 65 minutes to 90 days old and have exact timing"};
 const {data:existing,error:checkError}=await db.from("market_event_reactions")
  .select("id,is_published").eq("event_id",eventId).eq("symbol",symbol).eq("provider","twelve_data");
 if(checkError)return {success:false,http:500,error:"Unable to check existing reaction"};
 if((existing||[]).some(x=>x.is_published))
  return {success:false,http:409,error:"Published reactions are locked against automatic replacement"};
 if((existing||[]).length&&!force)
  return {success:true,already_available:true,horizons:(existing||[]).length};
 if(!PROVIDER_KEY)return {success:false,http:503,error:"Historical price provider key is not configured in Supabase Secrets"};
 try{
  const candles=await requestPrices(symbol,eventTime);
  const records=candles.map(c=>({...c,event_id:eventId,symbol,provider:"twelve_data",provider_source_url:DOCS_URL}));
  if(records.length){
   const {error:storeError}=await db.from("market_reaction_candles").upsert(records,{onConflict:"event_id,symbol,provider,bar_open"});
   if(storeError)throw new Error("Unable to record provider audit candles");
  }
  const {rows,missing,hasBaseline}=calculate(eventTime,symbol,candles);
  if(rows.length){
   const records=rows.map(r=>({...r,event_id:eventId,is_published:false,reviewed_at:null,license_confirmed_at:null}));
   const {error:saveError}=await db.from("market_event_reactions").upsert(records,{
    onConflict:"event_id,symbol,provider,horizon_minutes"
   });
   if(saveError)throw new Error("Unable to store price reaction");
  }
  await writeLog(eventId,symbol,rows.length===4?"success":rows.length?"partial":"unavailable",candles.length,rows.length,
   missing.length?"Missing exact M1 candles for horizons "+missing.join(","):"Complete M1 candles");
  return {success:true,recorded_candles:candles.length,
   calculated_horizons:rows.map(x=>x.horizon_minutes),
   missing_horizons:missing,baseline_available:hasBaseline,
   published:false,review_required:true};
 }catch(e){
  // Never return raw provider response or URLs with API credentials.
  await writeLog(eventId,symbol,"provider_error",0,0,"Provider or persistence failure");
  console.error("Market reaction sync:",e instanceof Error?e.message:"Unknown failure");
  return {success:false,http:502,error:"Historical price feed unavailable or unusable"};
 }
}
async function publish(eventId:string,symbol:string,confirmation:string){
 if(confirmation!=="I CONFIRM LICENSED REDISTRIBUTION RIGHTS")
  return {success:false,http:422,error:"Explicit source license and human review confirmation is required"};
 const {data,error}=await db.from("market_event_reactions").select("id")
  .eq("event_id",eventId).eq("symbol",symbol).eq("provider","twelve_data");
 if(error||!data?.length)return {success:false,http:404,error:"No provider-backed observations to review"};
 const at=new Date().toISOString();
 const {error:saveError}=await db.from("market_event_reactions").update({
  reviewed_at:at,license_confirmed_at:at,is_published:true
 }).eq("event_id",eventId).eq("symbol",symbol).eq("provider","twelve_data");
 if(saveError)return {success:false,http:500,error:"Could not publish verified observations"};
 return {success:true,published_count:data.length};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(!SUPABASE_URL||!SERVICE_ROLE)return respond({success:false,error:"Market reaction service not configured"},503);
 try{
  if(req.method==="GET"){
   const out=await publicList(new URL(req.url));
   return "error" in out?respond({success:false,error:out.error},400):respond(out,200,true);
  }
  if(req.method!=="POST")return respond({success:false,error:"Method not allowed"},405);
  if(!await admin(req))return respond({success:false,error:"Admin access required"},403);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object")return respond({success:false,error:"Invalid request"},400);
  const eventId=String(body.event_id||"").trim(),symbol=String(body.symbol||"").trim().toUpperCase();
  if(!uuid.test(eventId)||!SYMBOLS[symbol])return respond({success:false,error:"Valid event and supported symbol required"},400);
  const action=String(body.action||"");
  const result=action==="sync"?await sync(eventId,symbol,body.force===true)
   :action==="publish"?await publish(eventId,symbol,String(body.license_confirmation||""))
   :{success:false,http:400,error:"Unsupported action"};
  return respond(result,"http" in result?Number(result.http):200);
 }catch(e){console.error("market-reaction-api",e instanceof Error?e.message:"Unknown");
  return respond({success:false,error:"Market reaction service temporarily unavailable"},500)}
});
