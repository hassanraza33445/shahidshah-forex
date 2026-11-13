import assert from "node:assert/strict";
const base="https://qggtdwixwafcmorepkks.supabase.co";
const pub="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const endpoint=base+"/functions/v1/market-reaction-api";
async function check(name,path,init={}){
 const start=Date.now();
 const response=await fetch(endpoint+path,{
  ...init,headers:{apikey:pub,...(init.headers||{})},
  signal:AbortSignal.timeout(16000)
 });
 const data=await response.json().catch(()=>null);
 console.log("REACTION_API "+JSON.stringify({
  name,http:response.status,latency_ms:Date.now()-start,
  event_count:data?.items?.length||0,provider_integration:data?.provider_integration||null,
  error:data?.error||null
 }));
 return {response,data};
}
const main=await check("public-history","");
assert.equal(main.response.status,200);
assert.equal(main.data.success,true);
assert(Array.isArray(main.data.items));
assert.deepEqual(main.data.supported_symbols,["XAUUSD","EURUSD","GBPUSD","USDJPY","BTCUSD"]);
assert.deepEqual(main.data.horizons_minutes,[5,15,30,60]);
assert(["configured","awaiting_secure_api_key"].includes(main.data.provider_integration));
for(const item of main.data.items){
 assert.equal(item.time_precision,"exact");
 assert(item.source_url.startsWith("https://"));
 assert(Array.isArray(item.observations));
 for(const row of item.observations){
  assert(row.provider==="twelve_data"&&row.provider_source_url.startsWith("https://"));
  assert(Number.isFinite(Number(row.move_percent)));
 }
}
const filter=await check("gold-filter","?symbol=XAUUSD");
assert.equal(filter.response.status,200);
assert(filter.data.items.every(x=>x.observations.every(y=>y.symbol==="XAUUSD")));
assert.equal((await check("bad-symbol","?symbol=FAKEPAIR")).response.status,400);
assert.equal((await check("bad-event","?event_id=not-a-uuid")).response.status,400);
const unauth=await check("deny-unauthenticated-sync","",{
 method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({action:"sync",event_id:"11111111-1111-4111-8111-111111111111",symbol:"XAUUSD"})
});
assert.equal(unauth.response.status,403,"Only authenticated admins may make provider requests");
const preflight=await fetch(endpoint,{method:"OPTIONS",headers:{
 Origin:"https://www.smshahidshah.com",
 "Access-Control-Request-Method":"POST",
 "Access-Control-Request-Headers":"apikey,authorization,content-type"
},signal:AbortSignal.timeout(12000)});
assert.equal(preflight.status,204);
console.log("REACTION_API "+"preflight HTTP "+preflight.status);
const privatePrice=await fetch(base+"/rest/v1/market_reaction_candles?select=id&limit=1",{
 headers:{apikey:pub},signal:AbortSignal.timeout(12000)
});
assert([401,403].includes(privatePrice.status),"Anonymous raw candle access must be denied");
console.log("REACTION_API raw-candle-access: "+privatePrice.status);
const publicReactions=await fetch(base+"/rest/v1/market_event_reactions?select=id,is_published&limit=10",{
 headers:{apikey:pub},signal:AbortSignal.timeout(12000)
});
assert.equal(publicReactions.status,200);
const published=await publicReactions.json();
assert(Array.isArray(published)&&published.every(r=>r.is_published),"RLS must hide unreviewed data");
console.log("PASS live Market Reaction API: admin auth, source provenance, public RLS and no fake figures");
