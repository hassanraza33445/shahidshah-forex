import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";

const URL=Deno.env.get("SUPABASE_URL")||"";
let keys:Record<string,string>={};
try{keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||keys.default||"";
const APP=Deno.env.get("ONESIGNAL_APP_ID")||"";
const API=Deno.env.get("ONESIGNAL_REST_API_KEY")||"";
const ORIGIN="https://www.smshahidshah.com";
// Consistent PWA brand icon for Android Chrome/Web Push. The OS may still show Chrome as the sending app.
const BRAND_ICON=ORIGIN+"/icon-192.png";
// NBSP keeps the full display name together on the second title line.
const BRAND_LINE="S\u00a0M\u00a0Shahid\u00a0Shah";
const db=createClient(URL,SERVICE||"unconfigured",{auth:{persistSession:false,autoRefreshToken:false}});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
const DEMOS={
 gold:{title:"🟡 GOLD MARKET",body:"DEMO 1/4 · XAUUSD market news notification preview. Not a live trading signal."},
 forex:{title:"💱 FOREX MARKET",body:"DEMO 2/4 · Major currency news alert preview. No real announcement is implied."},
 calendar:{title:"📅 ECONOMIC CALENDAR",body:"DEMO 3/4 · CPI, NFP and FOMC event reminder preview. No event is currently scheduled by this test."},
 breaking:{title:"🔥 HOT MARKET NEWS",body:"DEMO 4/4 · Premium breaking news notification preview. No real market event is implied."}
} as const;
const validUuid=(x:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({success:false,error:"Method not allowed"},405);
 const token=req.headers.get("x-test-token")||"";
 if(!validUuid(token)||!SERVICE||SERVICE.length<30)return json({success:false,error:"Invalid or expired one-time authorization"},403);
 if(!/^[0-9a-f-]{36}$/i.test(APP)||API.length<12||
    Deno.env.get("ONESIGNAL_SUBSCRIPTIONS_ENABLED")!=="true")
  return json({success:false,error:"OneSignal not configured for subscriptions"},503);
 // Atomic single-use claim. Replay and guessing have no side effects.
 const {data:claim,error:claimError}=await db.from("market_push_test_requests")
  .update({used_at:new Date().toISOString(),status:"sending"})
  .eq("token",token).is("used_at",null).gt("expires_at",new Date().toISOString())
  .select("user_id,subscription_id,demo_type").maybeSingle();
 if(claimError)return json({success:false,error:"Unable to claim one-time test"},503);
 if(!claim)return json({success:false,error:"Invalid, used or expired one-time authorization"},403);
 const done=async(status:string,reason:string|null=null,id:string|null=null)=>{
  await db.from("market_push_test_requests").update({
   status,error_summary:reason,provider_message_id:id
  }).eq("token",token).eq("status","sending");
 };
 try{
  const [device,prefs]=await Promise.all([
   db.from("market_push_subscriptions")
    .select("user_id,active,browser_permission_granted,origin,disabled_at")
    .eq("subscription_id",claim.subscription_id).maybeSingle(),
   db.from("market_notification_preferences")
    .select("in_app_enabled,push_enabled")
    .eq("user_id",claim.user_id).maybeSingle()
  ]);
  if(device.error||prefs.error)throw Error("Cannot verify recipient consent");
  const d=device.data,p=prefs.data;
  if(!d?.active||!d.browser_permission_granted||d.disabled_at||d.origin!==ORIGIN||
    d.user_id!==claim.user_id||!p?.in_app_enabled||!p.push_enabled){
   await done("no_recipient","Consent or active subscription missing");
   return json({success:false,error:"The registered test device is no longer opted in"},422);
  }
  const demo=DEMOS[claim.demo_type as keyof typeof DEMOS]||DEMOS.gold;
  const response=await fetch("https://api.onesignal.com/notifications",{
   method:"POST",signal:AbortSignal.timeout(15000),
   headers:{"Authorization":"Key "+API,"Content-Type":"application/json"},
   body:JSON.stringify({
    app_id:APP,target_channel:"push",include_subscription_ids:[claim.subscription_id],
    headings:{en:demo.title+"\n"+BRAND_LINE},
    contents:{en:demo.body},
    chrome_web_icon:BRAND_ICON,
    url:ORIGIN+"/app/",
    idempotency_key:token,
    ttl:300,
    data:{test:true,demo_type:claim.demo_type}
   })
  });
  const payload=await response.json().catch(()=>({}));
  const id=typeof payload?.id==="string"?payload.id:"";
  if(!response.ok||!id){
   await done("failed",response.ok?"OneSignal accepted no message ID":"OneSignal HTTP "+response.status);
   return json({success:false,error:response.ok?"OneSignal returned no message ID":"OneSignal rejected test send",provider_status:response.status},502);
  }
  await done("accepted",null,id);
  return json({success:true,accepted_by_onesignal:true,device_count:1,delivery_confirmed:false,
   note:"Provider accepted request. Browser presentation is not confirmed."});
 }catch(e){
  await done("failed",e instanceof Error?e.message.slice(0,140):"Unexpected test error");
  return json({success:false,error:"Targeted notification test failed"},500);
 }
});
