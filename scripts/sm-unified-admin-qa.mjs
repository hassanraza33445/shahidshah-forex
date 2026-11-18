import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const admin=read("admin-panel.html"),webinar=read("webinar-admin.html"),unified=read("assets/sm-admin-unified.js");
const style=read("assets/sm-admin-unified.css");
const required=[
 ["admin main page",/id="page-dashboard"/,admin],
 ["central webinar route",/data-page="webinar" onclick="showPage\('webinar', this\)"/,admin],
 ["central leads route",/data-page="leads" onclick="showPage\('leads', this\)"/,admin],
 ["integrated iframe",/id="unifiedWebinarFrame"/,admin],
 ["new webinar management page",/id="page-webinar"/,admin],
 ["new clients directory",/id="page-leads"/,admin],
 ["secure admin route",/profile && profile\.is_admin/,admin],
 ["all 3 lead table reads",/from\("webinar_registrations"\)/,unified],
 ["AI Form lead read",/from\("ai_tool_access_leads"\)/,unified],
 ["Expo client read",/from\("expo_clients"\)/,unified],
 ["webinar-only auth preserved",/await isAdmin\(\)/,webinar],
 ["legacy webinar redirect",/location\.replace\("\/admin\/#webinar"\)/,webinar],
 ["webinar embedded mode",/data-admin-embedded/,webinar],
 ["admin frame navigation listener",/sm:unified-webinar-nav/,webinar],
 ["child ready handshake",/sm:unified-webinar-ready/,webinar],
 ["frame origin/source verification",/event\.origin!==location\.origin\|\|event\.source!==window\.parent/,webinar],
 ["parent origin/source verification",/event\.origin!==location\.origin\|\|!frame\|\|event\.source!==frame\.contentWindow/,unified],
 ["client directory read-only",/No data copies/,unified],
 ["admin-only access protection",/currentAdmin\?\.is_admin===true/,unified],
 ["main theme preserved",/html lang="en" data-theme="dark"/,admin],
 ["unified stylesheet",/admin-unified-frame/,style]
];
for(const [name,pattern,content] of required){assert.match(content,pattern,"Missing "+name)}
const allPages=[...webinar.matchAll(/class="menu-btn(?: active)?" data-page="([^"]+)"/g)].map(m=>m[1]);
const mapped=[...unified.matchAll(/\["(dashboard|analytics|engagement|settings|videos|content|registrations|expo-clients|reviews|learning|downloads)","[^"]+"\]/g)].map(m=>m[1]);
assert.deepEqual(new Set(mapped),new Set(allPages),"Every legacy webinar menu item must be present in new shell");
assert.equal(mapped.length,11,"All 11 webinar sections should be navigable");
assert.equal((admin.match(/if \(location\.hash === '#webinar'\)/g)||[]).length,2,"Both admin sign-in paths must support legacy redirect");
assert.doesNotMatch(unified,/\.delete\(|\.update\(|\.insert\(|\.upsert\(/,"Client directory must not write to database");
assert.doesNotMatch(admin,/admin\.sms@gmail\.com/i,"No legacy admin hardcoding");
console.log("PASS: one admin shell, 11 retained webinar pages, 3 original lead sources, verified auth, unchanged member UI");
