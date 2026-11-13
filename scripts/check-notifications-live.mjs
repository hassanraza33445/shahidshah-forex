import assert from "node:assert/strict";
const base="https://qggtdwixwafcmorepkks.supabase.co";
const pub="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const api=base+"/functions/v1/market-notifications-api";
async function request(name,path,init={}){
 const start=Date.now();
 const r=await fetch(api+path,{...init,headers:{apikey:pub,...(init.headers||{})},signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>null);
 console.log("NOTIFICATION_API "+JSON.stringify({name,http:r.status,ms:Date.now()-start,count:data?.items?.length||0,
  delivery:data?.delivery||null,push:data?.external_push||null,error:data?.error||null}));
 return {r,data};
}
const f=await request("live-public-feed","?mode=feed&limit=30");
assert.equal(f.r.status,200);
assert.equal(f.data.success,true);
assert(Array.isArray(f.data.items));
assert.equal(f.data.delivery,"in_app_only");
assert.equal(f.data.external_push,"not_configured");
assert(f.data.items.length>0,"Recent source-derived notifications must exist after verified backfill");
assert.equal(new Set(f.data.items.map(x=>x.id)).size,f.data.items.length,"No duplicated notifications");
for(const x of f.data.items){
 assert(["breaking_news","economic_reminder"].includes(x.kind));
 assert(["unverified","official_schedule","verified"].includes(x.trust_status));
 assert(x.target_url.startsWith("/")||x.target_url.startsWith("https://"));
 if(x.trust_status==="unverified")assert.match(x.body,/unverified/i,"Unverified headlines must be labeled");
}
const hot=await request("hot-filter","?mode=feed&kind=breaking_news&limit=30");
assert.equal(hot.r.status,200);
assert(hot.data.items.every(x=>x.kind==="breaking_news"));
const gold=await request("gold-filter","?mode=feed&topic=Gold");
assert.equal(gold.r.status,200);
assert(gold.data.items.every(x=>x.topic==="Gold"));
assert.equal((await request("reject-fake-topic","?mode=feed&topic=ZZZZ")).r.status,400);
assert.equal((await request("reject-fake-kind","?mode=feed&kind=push-now")).r.status,400);
assert.equal((await request("deny-account-preferences","?mode=preferences")).r.status,401);
assert.equal((await request("deny-private-inbox","?mode=inbox")).r.status,401);
const unauthorized=await request("deny-unauthorized-save","",{method:"POST",
 headers:{"Content-Type":"application/json"},
 body:JSON.stringify({action:"save_preferences",settings:{
  in_app_enabled:true,breaking_enabled:true,economic_enabled:true,
  topics:["Gold"],reminders:[15],timezone:"Asia/Kuala_Lumpur",push_enabled:false
 }})});
assert.equal(unauthorized.r.status,401,"Guest cannot save cross-user settings");
const preflight=await fetch(api,{method:"OPTIONS",headers:{Origin:"https://www.smshahidshah.com",
 "Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"apikey,authorization,content-type"},
 signal:AbortSignal.timeout(12000)});
assert.equal(preflight.status,204);
console.log("NOTIFICATION_API preflight: "+preflight.status);
const anonPref=await fetch(base+"/rest/v1/market_notification_preferences?select=user_id&limit=1",{
 headers:{apikey:pub},signal:AbortSignal.timeout(12000)});
assert([401,403].includes(anonPref.status),"Guest cannot read private notification preferences");
console.log("NOTIFICATION_API anon_preferences HTTP "+anonPref.status);
console.log("PASS notification public feed, editorial source labels, topic filters, no push and private-account API guards");
