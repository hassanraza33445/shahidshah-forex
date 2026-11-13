import assert from "node:assert/strict";
const url="https://qggtdwixwafcmorepkks.supabase.co/functions/v1/economic-calendar-api";
const key="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
async function call(label,params="",init={}){
 const started=Date.now();
 const response=await fetch(url+params,{...init,headers:{apikey:key,...(init.headers||{})},signal:AbortSignal.timeout(18000)});
 const data=await response.json();
 console.log("CALENDAR_CHECK "+JSON.stringify({label,http:response.status,ms:Date.now()-started,count:data?.items?.length,error:data.error||null,source_status:data.source_status||null}));
 return {response,data};
}
const base=await call("upcoming","");
assert.equal(base.response.status,200);
assert.equal(base.data.success,true);
assert.ok(Array.isArray(base.data.items)&&base.data.items.length>=5);
assert.ok(base.data.items.every(x=>x.title&&x.currency==="USD"&&x.source_url.startsWith("https://")&&x.last_verified_at));
assert.ok(base.data.items.every(x=>x.actual===null&&x.forecast===null&&x.previous===null),"No invented economic readings");
const timestamps=base.data.items.map(x=>new Date(x.scheduled_at).getTime());
assert.ok(timestamps.every(Number.isFinite));
assert.deepEqual([...timestamps].sort((a,b)=>a-b),timestamps);
const high=await call("high","?impact=HIGH");
assert.equal(high.response.status,200);
assert.ok(high.data.items.length>0&&high.data.items.every(x=>x.impact==="HIGH"));
const bad=await call("invalid-range","?from=2027-12-01&to=2026-01-01");
assert.equal(bad.response.status,400);
const forbidden=await call("deny-public-admin","",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"action":"sync-bls"}'});
assert.equal(forbidden.response.status,403);
const warm=await call("schedule-official-sync","?mode=warm");
assert.equal(warm.response.status,202);
console.log("PASS verified Economic Calendar API, filters, source authenticity, RLS facade and guarded refresh");
