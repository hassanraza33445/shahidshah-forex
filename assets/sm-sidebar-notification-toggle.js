/* Sidebar notifications: one voluntary, account-synced ON/OFF switch.
 * Existing OneSignal provider, RLS preferences and verified-only delivery rules apply.
 * Browser permission is NEVER requested except from the user's direct ON action.
 */
(()=>{"use strict";
 const PROJECT="https://qggtdwixwafcmorepkks.supabase.co";
 const KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
 const ORIGIN="https://www.smshahidshah.com";
 const TOPICS=["Gold","Forex","Crypto","Central Banks","Economic Data","Energy","Geopolitics"];
 const REMINDERS=[60,15,0];
 let client=null,user=null,checkbox=null,status=null,ready=false,busy=false,sdk=null,preferences=null;
 let sdkLoading=null;
 const msg=(v)=>{if(status)status.textContent=v};
 function render(on,detail){
  if(checkbox){checkbox.checked=Boolean(on);checkbox.setAttribute("aria-checked",String(Boolean(on)));checkbox.disabled=!ready||busy}
  msg(detail|| (on?"ON · All market alerts":"OFF · Tap to enable"));
 }
 async function api(mode="",body=null){
  const {data:{session},error}=await client.auth.getSession();
  if(error||!session?.access_token)throw Error("Sign in again to manage notifications.");
  const r=await fetch(PROJECT+"/functions/v1/market-notifications-api"+(mode?"?mode="+encodeURIComponent(mode):""),{
   method:body?"POST":"GET",cache:"no-store",signal:AbortSignal.timeout(18000),
   headers:{apikey:KEY,Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const out=await r.json().catch(()=>null);
  if(!r.ok||!out?.success)throw Error(out?.error||"Notification settings unavailable.");
  return out;
 }
 function settings(old,on){
  return {
   in_app_enabled:on,breaking_enabled:on,economic_enabled:on,keyword_alerts_enabled:on,
   topics:on?TOPICS:[],reminders:on?REMINDERS:[],
   timezone:old?.timezone||"Asia/Karachi",
   quiet_start:old?.quiet_start??null,
   quiet_end:old?.quiet_end??null
  };
 }
 async function bootSDK(config){
  if(sdk)return sdk;
  if(sdkLoading)return sdkLoading;
  sdkLoading=new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error("OneSignal is taking too long to load.")),18000);
   window.OneSignalDeferred=window.OneSignalDeferred||[];
   window.OneSignalDeferred.push(async OneSignal=>{
    try{
     await OneSignal.init({appId:config.app_id,
      serviceWorkerPath:config.worker||"/onesignal/OneSignalSDKWorker.js",
      serviceWorkerParam:{scope:"/onesignal/"},
      notifyButton:{enable:false},promptOptions:{autoPrompt:false}});
     clearTimeout(timeout);sdk=OneSignal;resolve(OneSignal);
    }catch(e){clearTimeout(timeout);reject(e)}
   });
   if(!document.querySelector('script[data-sm-sidebar-onesignal]')){
    const script=document.createElement("script");script.async=true;
    script.dataset.smSidebarOnesignal="1";
    script.src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.onerror=()=>{clearTimeout(timeout);reject(Error("OneSignal could not be loaded."))};
    document.head.append(script);
   }
  }).catch(e=>{sdkLoading=null;throw e});
  return sdkLoading;
 }
 async function currentDeviceActive(){
  if(!preferences?.push_enabled||!sdk||typeof Notification==="undefined"||Notification.permission!=="granted")return false;
  const sub=sdk.User?.PushSubscription;
  if(!sub?.id||sub.optedIn!==true)return false;
  const {data,error}=await client.from("market_push_subscriptions")
   .select("subscription_id").eq("user_id",user.id).eq("subscription_id",sub.id)
   .eq("active",true).maybeSingle();
  if(error)throw Error("Device subscription could not be verified.");
  return Boolean(data?.subscription_id);
 }
 async function getSubscriptionId(){
  for(let n=0;n<24;n++){
   if(sdk?.User?.PushSubscription?.id)return sdk.User.PushSubscription.id;
   await new Promise(r=>setTimeout(r,250));
  }
  throw Error("Browser subscription is not ready. Please try again.");
 }
 async function setOn(){
  if(typeof Notification==="undefined")throw Error("This browser does not support notifications.");
  if(Notification.permission==="denied")throw Error("Notifications are blocked. Allow them in your browser site settings.");
  const sub=sdk?.User?.PushSubscription;
  if(!sub)throw Error("OneSignal is not ready.");
  // This is synchronous with the user interaction: never request permission on page load.
  const permissionPromise=sdk.Notifications.requestPermission();
  const allowed=await permissionPromise;
  if(allowed===false||Notification.permission!=="granted")throw Error("Browser permission is required to turn notifications ON.");
  const old=preferences;
  const all=settings(old,true);
  await api("",{action:"save_preferences",settings:all});
  try{
   await sub.optIn();
   const id=await getSubscriptionId();
   await api("",{action:"register_push_device",subscription_id:id,browser_permission_granted:true});
   preferences=(await api("preferences")).settings;
  }catch(e){
   // Revert consent options if server-side registration was unsuccessful.
   if(old)await api("",{action:"save_preferences",settings:settings(old,Boolean(old.in_app_enabled))}).catch(()=>{});
   await sub.optOut().catch(()=>{});
   throw e;
  }
  render(true,"ON · All market alerts");
 }
 async function setOff(){
  // Revoke every saved browser subscription on this account before muting the feed.
  await api("",{action:"unregister_all_push_devices"});
  await api("",{action:"save_preferences",settings:settings(preferences,false)});
  await sdk?.User?.PushSubscription?.optOut().catch(()=>{});
  preferences=(await api("preferences")).settings;
  render(false,"OFF · Tap to enable");
 }
 async function onChange(){
  if(!ready||busy)return;
  const requested=checkbox.checked;
  busy=true;checkbox.disabled=true;
  msg(requested?"Enabling notifications…":"Turning notifications off…");
  try{
   if(requested)await setOn();else await setOff();
  }catch(e){
   const active=await currentDeviceActive().catch(()=>false);
   render(active,e instanceof Error?e.message:"Notification setting failed.");
  }finally{busy=false;checkbox.disabled=!ready}
 }
 async function init(c,verifiedUser){
  if(!verifiedUser||!c||client)return;
  client=c;user=verifiedUser;
  checkbox=document.getElementById("smSidebarNotifyToggle");
  status=document.getElementById("smSidebarNotifyStatus");
  if(!checkbox||!status)return;
  checkbox.checked=false;checkbox.disabled=true;checkbox.addEventListener("change",onChange);
  msg("Checking notifications…");
  try{
   if(location.origin!==ORIGIN)throw Error("Open the www website for browser notifications.");
   const [pref,configResponse]=await Promise.all([
    api("preferences"),
    fetch(PROJECT+"/functions/v1/market-notifications-api?mode=push-config",{
     cache:"no-store",signal:AbortSignal.timeout(12000),headers:{apikey:KEY}
    }).then(r=>r.json())
   ]);
   preferences=pref.settings;
   if(!configResponse?.configured||!configResponse?.app_id)throw Error("Browser notifications are not configured.");
   if(typeof Notification==="undefined")throw Error("Notifications are unsupported in this browser.");
   if(Notification.permission==="denied")throw Error("Blocked in browser settings");
   const one=await bootSDK(configResponse);
   if(one.Notifications?.isPushSupported?.()===false)throw Error("Install the app to enable notifications.");
   ready=true;
   render(await currentDeviceActive(),"");
   checkbox.disabled=false;
  }catch(e){
   ready=false;render(false,e instanceof Error?e.message:"Notifications unavailable");
  }
 }
 window.SMSidebarPush={init};
})();