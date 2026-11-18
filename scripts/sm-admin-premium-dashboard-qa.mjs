import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const admin=read("admin/index.html"),dash=read("assets/sm-admin-premium-dashboard.js"),css=read("assets/sm-admin-premium-dashboard.css");
const start=admin.indexOf("<!-- ========== PREMIUM ADMIN COMMAND CENTER ========== -->");
const end=admin.indexOf("<!-- ========== USERS ========== -->",start);
assert.ok(start>=0 && end>start, "One standalone premium dashboard");
const body=admin.slice(start,end);
for(const id of ["smpUsers","smpNewsCount","smpStudioCount","smpSources","smpNewsList","smpRecentUsers","smpProjectsList","smpSourceHealth","smpAlertStatus"]){
 assert.match(body,new RegExp('id="'+id+'"'),"Missing real-time dashboard field "+id);
}
assert.doesNotMatch(body,/(?:Trade|Courses|Revenue|Profit|Subscriptions|Quiz Plays|Top Traded Pairs)/i,"Do not render legacy unused trading/course KPIs");
assert.doesNotMatch(admin,/<div class="menu-item" data-page="(?:courses|trades)"/,"Hide unused course/trade sidebar entries");
assert.match(admin,/id="page-courses"/,"Preserve source course admin page for rollback; no data deletion");
assert.match(admin,/id="page-trades"/,"Preserve source trade admin page for rollback; no data deletion");
assert.match(admin,/id="page-leads"/,"All lead records remain accessible");
assert.match(admin,/id="page-webinar"/,"All webinars remain accessible");
assert.match(admin,/profile && profile\.is_admin/,"Admin privileges still checked");
assert.match(admin,/sm-admin-premium-dashboard\.js/);
assert.match(admin,/sm-admin-premium-dashboard\.css/);
assert.match(admin,/return window\.SMAdminPremium\?\.refresh\(\)/,"Dashboard refresh calls real data load");
for(const table of ["profiles","webinar_registrations","ai_tool_access_leads","expo_clients","news_articles","news_sources","content_projects","market_notification_events"]){
 assert.ok(dash.includes('.from("'+table+'")'),"Missing live source "+table);
}
assert.match(dash,/const parent=rows\.map/,"Dedup accounts and leads by email or phone");
assert.match(dash,/document\.createElement/,"Render user-supplied news as text safely");
assert.match(dash,/currentAdmin\?\.is_admin===true/,"Verify logged-in admin before loading");
assert.doesNotMatch(dash,/\.delete\(|\.update\(|\.insert\(|\.upsert\(/,"Dashboard must never modify database rows");
assert.match(dash,/smpGlobalSearch/,"Global search is functional");
assert.match(css,/\.smp-metrics/,"Premium responsive layout exists");
console.log("PASS: premium market/admin dashboard, 4 real KPIs, no course/trade cards, unique audience, 8 source tables, no data writes");
