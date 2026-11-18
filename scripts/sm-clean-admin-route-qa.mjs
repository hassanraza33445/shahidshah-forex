import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const canonical=read("admin/index.html");
const legacyAdmin=read("admin-panel.html");
const legacyWebinar=read("webinar-admin.html");
const legacyWebinarPath=read("webinar-admin/index.html");
const rewrites=JSON.parse(read("vercel.json")).rewrites;
const expected=["/admin","/admin/"];
for(const route of expected){
 assert.equal(rewrites.find(x=>x.source===route)?.destination,"/admin/index.html","Vercel must resolve "+route);
}
assert.match(canonical,/id="page-dashboard"/);
assert.match(canonical,/id="page-webinar"/);
assert.match(canonical,/id="page-leads"/);
assert.match(canonical,/profile && profile\.is_admin/,"Admin permission must be verified");
assert.match(canonical,/sm-admin-unified\.js/,"Unified admin script retained");
assert.match(canonical,/sm-admin-unified\.css/,"Unified admin style retained");
assert.match(canonical,/window\.open\('\/', '_blank'\)/,"Public homepage links must work from nested /admin/");
assert.match(canonical,/<meta name="robots" content="noindex,nofollow">/,"No admin URL indexing");
assert.match(legacyAdmin,/location\.replace\("\/admin\/"\+location\.search\+location\.hash\)/,"Legacy admin URL must preserve hash");
assert.match(legacyWebinar,/else location\.replace\("\/admin\/#webinar"\)/,"Standalone webinar link must redirect");
assert.match(legacyWebinar,/if\(embedded\)document\.documentElement\.dataset\.adminEmbedded/,"Internal embedded webinar must not redirect");
assert.match(legacyWebinarPath,/location\.replace\("\/admin\/#webinar"\)/,"Old webinar directory route must redirect");
assert.match(legacyWebinar,/await isAdmin\(\)/,"Webinar authentication must remain");
assert.doesNotMatch(canonical,/location\.replace\("\/admin\/"\+location\.search/,"Canonical page must not redirect to itself");
console.log("PASS: clean /admin/ page, legacy links, embedded webinar and authorization");
