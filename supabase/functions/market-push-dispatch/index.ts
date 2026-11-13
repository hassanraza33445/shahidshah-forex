import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";

const DB=Deno.env.get("SUPABASE_URL")||"";
let secrets:Record<string,string>={};try{secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||secrets.default||"";
const APP=Deno.env.get("ONESIGNAL_APP_ID")||"";
const KEY=Deno.env.get("ONESIGNAL_REST_API_KEY")||"";
const ORIGIN="https://www.smshahidshah.com";
const db=createClient(DB,SECRET||"unconfigured",{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
function quiet(pref:any,stamp:Date){
 const a=String(pref.quiet_start||"").slice(0,5),b=String(pref.quiet_end||"").slice(0,5);
 if(!a||!b||a===b)return false;
 const fmt=new Intl.DateTimeFormat("en-GB",{
  timeZone:pref.timezone||"Asia/Kuala_Lumpur",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 });
 const current=fmt.format(stamp).replace(/[^0-9:]/g,"");
 return a<b?current>=a&&current<b:current>=a||current<b;
}
async function finalize(id:string,state:string,error:string|null=null,provider:string|null=null,next:string|null=null){
 const updates:any={state,last_error:error,provider_message_id:provider,locked_until:null};
 if(state==="retry")updates.next_attempt_at=next;
 else updates.processed_at=new Date().toISOString();
 const {error:dbErr}=await db.from("market_push_deliveries").update(updates).eq("id",id);
 if(dbErr)throw Error("Unable to save delivery status");
}
async function handle(job:any){
 const now=new Date();
 try{
  const [n,d,p]=await Promise.all([
   db.from("market_notification_events")
    .select("id,title,body,kind,trust_status,topic,reminder_minutes,target_url,expires_at,created_at,is_active")
    .eq("id",job.notice_id).maybeSingle(),
   db.from("market_push_subscriptions").select("user_id,active,browser_permission_granted")
    .eq("subscription_id",job.subscription_id).maybeSingle(),
   db.from("market_notification_preferences")
    .select("push_enabled,in_app_enabled,breaking_enabled,economic_enabled,topics,reminders,timezone,quiet_start,quiet_end")
    .eq("user_id",job.user_id).maybeSingle()
  ]);
  if(n.error||d.error||p.error)throw Error("Recipient records inaccessible");
  const notice=n.data,device=d.data,pref=p.data;
  const fresh=notice?.kind==="economic_reminder"?8*60000:12*60000;
  if(!notice?.is_active||!device?.active||!device?.browser_permission_granted||
   device.user_id!==job.user_id||!pref?.push_enabled||!pref.in_app_enabled){
   await finalize(job.id,"no_recipient","Consent or active subscription missing");return "skipped";
  }
  if(now.getTime()>Date.parse(notice.expires_at)||now.getTime()-Date.parse(notice.created_at)>fresh){
   await finalize(job.id,"expired","Alert no longer timely");return "skipped";
  }
  const canSend=notice.kind==="economic_reminder"?
   notice.trust_status==="official_schedule"&&pref.economic_enabled&&pref.reminders?.includes(notice.reminder_minutes):
   notice.kind==="breaking_news"&&notice.trust_status==="verified"&&pref.breaking_enabled&&pref.topics?.includes(notice.topic);
  if(!canSend){
   await finalize(job.id,"no_recipient","Source or topic is not opted in");return "skipped";
  }
  if(quiet(pref,now)){
   // Never send event-time reminders after user's quiet hours have passed.
   await finalize(job.id,"quiet_hours","Quiet hours suppress this time-sensitive alert");return "skipped";
  }
  const link=notice.target_url.startsWith("/")?ORIGIN+notice.target_url:notice.target_url;
  const response=await fetch("https://api.onesignal.com/notifications",{
   method:"POST",signal:AbortSignal.timeout(12000),
   headers:{"Authorization":"Key "+KEY,"Content-Type":"application/json"},
   body:JSON.stringify({
    app_id:APP,target_channel:"push",include_subscription_ids:[job.subscription_id],
    headings:{en:notice.kind==="economic_reminder"?"Upcoming Economic Event":"Verified Market News"},
    contents:{en:String(notice.title).slice(0,170)},
    url:link,idempotency_key:job.idempotency_key,
    ttl:notice.kind==="economic_reminder"?300:900,
    data:{notice_id:notice.id,kind:notice.kind}
   })
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
   if([429,500,502,503,504].includes(response.status)&&job.attempts<3){
    await finalize(job.id,"retry","Transient API HTTP "+response.status,null,
     new Date(Date.now()+60000*Math.pow(2,job.attempts)).toISOString());
    return "retry";
   }
   await finalize(job.id,"failed","OneSignal HTTP "+response.status);return "failed";
  }
  if(typeof payload?.id==="string"&&payload.id){
   await finalize(job.id,"sent",null,payload.id);return "accepted";
  }
  await finalize(job.id,"no_recipient","OneSignal returned no message ID");return "skipped";
 }catch(e){
  await finalize(job.id,"failed",e instanceof Error?e.message.slice(0,120):"Delivery failed")
   .catch(()=>{});
  return "failed";
 }
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 // Cron or manual verified service-only requests: no public and no logged-in user access.
 if(!SECRET||SECRET.length<30||req.headers.get("authorization")!=="Bearer "+SECRET)
  return json({error:"Service authorization required"},403);
 if(!/^[0-9a-f-]{36}$/i.test(APP)||KEY.length<12)return json({
  success:false,error:"Configure OneSignal App ID and REST key in Supabase Secrets first",
  dispatch_enabled:false
 },503);
 try{
  const {data:created,error:queuedError}=await db.rpc("enqueue_verified_market_pushes");
  if(queuedError)throw Error("Push queue unavailable");
  const {data:jobs,error:claimError}=await db.rpc("claim_market_push_deliveries",{p_limit:8});
  if(claimError)throw Error("Push queue claim unavailable");
  let accepted=0,skipped=0,failed=0,retry=0;
  for(const job of jobs||[]){
   const outcome=await handle(job);
   if(outcome==="accepted")accepted++;
   else if(outcome==="retry")retry++;
   else if(outcome==="failed")failed++;
   else skipped++;
  }
  return json({success:true,queued:created?.queued||0,processed:(jobs||[]).length,
   accepted_by_onesignal:accepted,skipped,failed,retries_scheduled:retry,
   note:"OneSignal accepted means created, not confirmed delivered to browser"});
 }catch(e){
  console.error("push-dispatch",e instanceof Error?e.message:"unknown");
  return json({success:false,error:"OneSignal dispatch temporarily unavailable"},500);
 }
});
