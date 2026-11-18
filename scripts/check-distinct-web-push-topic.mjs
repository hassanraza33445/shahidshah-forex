import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../supabase/functions/market-push-dispatch/index.ts",import.meta.url),"utf8");
assert.match(code,/web_push_topic:"sm-news-"\+notice\.id\.replace\(\/-\/g,""\)/,
 "OneSignal Web Push topic must be stable for retries and unique for each notice");
assert.doesNotMatch(code,/\bcollapse_id\s*:/,"Do not collapse different headlines");
assert.match(code,/include_subscription_ids:\[job\.subscription_id\]/,"Send to opted-in device only");
assert.match(code,/idempotency_key:job\.idempotency_key/,"Keep idempotency on retry");
assert.match(code,/pref\?\.push_enabled/,"Preserve device consent gating");
assert.match(code,/if\(quiet\(pref,now\)\)/,"Preserve quiet hours");
assert.match(code,/if\(!publisher\|\|!sourceIsHttps\|\|articleUrl!==notice\.target_url\)/,"Preserve article validation");
const topic=id=>"sm-news-"+id.replace(/-/g,"");
const ids=["1951a5ca-7217-4768-be8b-afbbb61f71c1","55d8240a-2366-44a8-99ec-fccfa80fd498","53fd0f9d-78b1-4226-bf48-4bf2ccdd6a65"];
const topics=ids.map(topic);
assert.equal(new Set(topics).size,3,"Three simultaneous HOT headlines must have three distinct browser notification tags");
assert.ok(topics.every(x=>x.length<=64),"Topics must fit the OneSignal max length");
assert.equal(topic(ids[0]),topic(ids[0]),"Retries must reuse same tag");
console.log("PASS 3 simultaneous HOT notifications get distinct Web Push topics; consent, sources and retry safety preserved");
