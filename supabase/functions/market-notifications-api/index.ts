import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";

const DB_URL=Deno.env.get("SUPABASE_URL")||"";
let secrets:Record<string,string>={};try{secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||secrets.default||"";
const db=createClient(DB_URL,KEY||"unconfigured",{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const reply=(body:unknown,status=200,cache=false)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,"Content-Type":"application/json; charset=utf-8",
 "Cache-Control":cache?"public,s-maxage=30,stale-while-revalidate=60":"no-store"}
});
const TOPICS=["Gold","Forex","Crypto","Central Banks","Economic Data","Energy","Geopolitics"] as const;
const ZONES=["Asia/Kuala_Lumpur","Asia/Karachi","America/New_York","UTC"] as const;
const REMINDERS=[60,15,0] as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULTS={
 in_app_enabled:false,breaking_enabled:false,economic_enabled:false,
 topics:["Gold","Forex","Crypto","Central Banks","Economic Data"],
 reminders:[60,15,0],timezone:"Asia/Kuala_Lumpur",
 quiet_start:null,quiet_end:null,push_enabled:false
};
function includesString<T extends string>(list:readonly T[],x:unknown):x is T{
 return typeof x==="string"&&list.includes(x as T);
}
function cleanPreferences(body:any){
 if(!body||typeof body!=="object"||Array.isArray(body))throw Error("Invalid notification settings");
 const bools=["in_app_enabled","breaking_enabled","economic_enabled"] as const;
 for(const name of bools)if(typeof body[name]!=="boolean")throw Error("Expected "+name+" toggle");
 if(!Array.isArray(body.topics)||body.topics.length>TOPICS.length||
  body.topics.some((v:unknown)=>!includesString(TOPICS,v)))throw Error("Invalid topics");
 if(!Array.isArray(body.reminders)||body.reminders.length>3||
  body.reminders.some((v:unknown)=>typeof v!=="number"||!REMINDERS.includes(v as 0|15|60)))throw Error("Invalid reminders");
 if(!includesString(ZONES,body.timezone))throw Error("Invalid timezone");
 if(body.push_enabled===true)throw Error("External push is not connected; push cannot be enabled");
 const quiet=(x:unknown)=>{
  if(x===null||x===undefined||x==="")return null;
  if(typeof x!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x))throw Error("Quiet hours must be HH:MM");
  return x;
 };
 const quiet_start=quiet(body.quiet_start),quiet_end=quiet(body.quiet_end);
 if((quiet_start===null)!==(quiet_end===null))throw Error("Set both quiet-hour times");
 return {
  in_app_enabled:body.in_app_enabled,
  breaking_enabled:body.breaking_enabled,
  economic_enabled:body.economic_enabled,
  topics:[...new Set(body.topics)],
  reminders:[...new Set(body.reminders)],
  timezone:body.timezone,
  quiet_start,quiet_end,
  push_enabled:false,
  updated_at:new Date().toISOString()
 };
}
async function signedIn(req:Request){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token||token===KEY)return null;
 const {data:{user},error}=await db.auth.getUser(token);
 return error||!user?null:user;
}
async function feed(url:URL){
 const rawKind=url.searchParams.get("kind")||"";
 const kind=["","breaking_news","economic_reminder"].includes(rawKind)?rawKind:null;
 const topic=url.searchParams.get("topic")||"";
 const limit=Math.max(1,Math.min(40,Number(url.searchParams.get("limit")||30)||30));
 if(kind===null)return reply({success:false,error:"Invalid alert type"},400);
 if(topic&&!includesString(TOPICS,topic))return reply({success:false,error:"Invalid topic"},400);
 let q=db.from("market_notification_events")
  .select("id,kind,title,body,topic,impact,trust_status,target_url,source_article_id,source_event_id,reminder_minutes,created_at,expires_at")
  .eq("is_active",true).lte("created_at",new Date().toISOString())
  .gt("expires_at",new Date().toISOString())
  .order("created_at",{ascending:false}).limit(limit);
 if(kind)q=q.eq("kind",kind);
 if(topic)q=q.eq("topic",topic);
 const {data,error}=await q;
 if(error)throw Error("Alerts unavailable");
 return reply({success:true,items:data||[],last_checked:new Date().toISOString(),
  delivery:"in_app_only",external_push:"not_configured",
  warning:"HOT is editorial relevance, not confirmed market movement. Unverified sources are labeled."},200,true);
}
async function privateGet(req:Request,mode:string){
 const user=await signedIn(req);
 if(!user)return reply({success:false,error:"Sign in to use account-synced notification preferences"},401);
 if(mode==="preferences"){
  const {data,error}=await db.from("market_notification_preferences")
   .select("in_app_enabled,breaking_enabled,economic_enabled,topics,reminders,timezone,quiet_start,quiet_end,push_enabled,updated_at")
   .eq("user_id",user.id).maybeSingle();
  if(error)throw Error("Notification settings unavailable");
  return reply({success:true,settings:data||DEFAULTS,account_synced:!!data,push_available:false});
 }
 if(mode==="inbox"){
  const {data:entries,error}=await db.from("market_notification_inbox")
   .select("notice_id,queued_at,read_at").eq("user_id",user.id)
   .order("queued_at",{ascending:false}).limit(80);
  if(error)throw Error("Notification inbox unavailable");
  const ids=(entries||[]).map(x=>x.notice_id);
  let notices:any[]=[];
  if(ids.length){
   const result=await db.from("market_notification_events")
    .select("id,kind,title,body,topic,impact,trust_status,target_url,reminder_minutes,created_at,expires_at,is_active")
    .in("id",ids).eq("is_active",true).gt("expires_at",new Date().toISOString());
   if(result.error)throw Error("Notification items unavailable");
   notices=result.data||[];
  }
  const byId=new Map(notices.map(x=>[x.id,x]));
  const items=(entries||[]).map(e=>byId.get(e.notice_id)?{
   ...byId.get(e.notice_id),queued_at:e.queued_at,read_at:e.read_at
  }:null).filter(Boolean);
  return reply({success:true,items,unread:items.filter((x:any)=>!x.read_at).length,
   delivery:"in_app_only",account_synced:true});
 }
 return reply({success:false,error:"Unknown account mode"},400);
}
async function privatePost(req:Request){
 const user=await signedIn(req);
 if(!user)return reply({success:false,error:"Sign in required"},401);
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return reply({success:false,error:"Invalid JSON body"},400);
 if(body.action==="save_preferences"){
  let settings:any;
  try{settings=cleanPreferences(body.settings)}catch(e){
   return reply({success:false,error:e instanceof Error?e.message:"Invalid settings"},400);
  }
  const {error}=await db.from("market_notification_preferences")
   .upsert({...settings,user_id:user.id},{onConflict:"user_id"});
  if(error)throw Error("Unable to save notification settings");
  return reply({success:true,settings,account_synced:true,push_available:false});
 }
 if(body.action==="mark_read"){
  const id=typeof body.id==="string"?body.id:"";
  if(!UUID.test(id))return reply({success:false,error:"Invalid notification ID"},400);
  const {data,error}=await db.from("market_notification_inbox")
   .update({read_at:new Date().toISOString()})
   .eq("user_id",user.id).eq("notice_id",id).is("read_at",null)
   .select("notice_id");
  if(error)throw Error("Unable to mark notification as read");
  return reply({success:true,updated:(data||[]).length>0});
 }
 return reply({success:false,error:"Unknown notification action"},400);
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(!DB_URL||!KEY)return reply({success:false,error:"Notification service not configured"},503);
 try{
  const url=new URL(req.url);
  if(req.method==="GET"){
   const mode=url.searchParams.get("mode")||"feed";
   if(mode==="feed")return await feed(url);
   if(mode==="preferences"||mode==="inbox")return await privateGet(req,mode);
   return reply({success:false,error:"Unknown mode"},400);
  }
  if(req.method==="POST")return await privatePost(req);
  return reply({success:false,error:"Method not allowed"},405);
 }catch(e){
  console.error("market-notifications-api",e instanceof Error?e.message:"Unexpected error");
  return reply({success:false,error:"Notification service temporarily unavailable"},500);
 }
});
