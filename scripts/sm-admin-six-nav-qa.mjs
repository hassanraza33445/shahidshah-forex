import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const admin=read("admin/index.html");
const nav=read("assets/sm-admin-six-navigation.js");
const styles=read("assets/sm-admin-six-navigation.css");
const dashboard=read("assets/sm-admin-premium-dashboard.js");
const defaultGroups=[
 ["dashboard","dashboard"],["audience","leads"],["market","newshub"],
 ["studio","studioaccess"],["webinar","webinar"],["settings","settings"]
];
const buttons=[...admin.matchAll(/<button type="button" class="menu-item admin-nav-main(?: active)?" data-page="([^"]+)" data-admin-group="([^"]+)"/g)];
assert.equal(buttons.length,6,"Exactly 6 main sidebar sections");
assert.deepEqual(buttons.map(m=>[m[2],m[1]]),defaultGroups,"Expected names and order");
assert.doesNotMatch(admin,/class="menu-item" data-page="(?:subscriptions|messages|emails|logs|quiz|youtube|courses|trades)"/,
 "Unused feature items must be hidden from sidebar only");
const retained=["dashboard","analytics","users","trades","subscriptions","courses","news","newshub","studioaccess","quiz","youtube","webinar","leads","messages","notifications","emails","settings","appearance","logs","profile"];
retained.forEach(page=>assert.match(admin,new RegExp('id="page-'+page+'"'),"Original protected page missing "+page));
assert.match(admin,/id="adminSectionNav"/,"Context tabs container");
assert.match(admin,/id="adminSectionTabs"/,"Context tabs");
assert.match(admin,/id="adminNavShade" hidden/,"Mobile backdrop");
assert.match(admin,/sm-admin-six-navigation\.js\?v=/);
assert.match(admin,/sm-admin-six-navigation\.css\?v=/);
assert.match(admin,/window\.SMAdminNav\?\.onPage\(page\)/,"showPage must synchronize active group");
assert.match(admin,/window\.SMAdminNav\.toggleSidebar\(\)/,"Mobile menu needs proper backdrop");
for(const deepLink of ["#webinar","#leads","#studio-access"]){
 assert.ok(admin.includes("location.hash === '"+deepLink+"'"),"Known login deep link must remain accessible: "+deepLink);
}
assert.match(dashboard,/showPage\(page,target\)/,"Dashboard shortcuts must navigate grouped sub-pages");
assert.match(styles,/@media\(max-width:768px\)/,"Mobile responsive CSS");
assert.match(nav,/href="\/app\/\?tab=studio"|url:"\/app\/\?tab=studio"/,"Studio launch must open authenticated workspace");
assert.doesNotMatch(nav,/\.from\(|\.update\(|\.insert\(|\.delete\(|\.upsert\(/,"Navigation cannot touch data");
assert.match(admin,/profile && profile\.is_admin/,"Admin authorization preserved");
assert.match(admin,/id="unifiedWebinarFrame"/);
assert.match(admin,/id="unifiedLeadsBody"/);
assert.match(admin,/id="adminSectionName"/);
// Minimal runtime test for grouped tabs, focus semantics and mobile backdrop.
class El {
 constructor(){this.children=[];this.hidden=false;this.dataset={};this.style={};
  this.attrs={};this.classSet=new Set();this.classList={
    add:n=>this.classSet.add(n),remove:n=>this.classSet.delete(n),
    toggle:(n,force)=>{if(force===undefined){force=!this.classSet.has(n)}
      if(force)this.classSet.add(n);else this.classSet.delete(n);return force},
    contains:n=>this.classSet.has(n)};
 }
 appendChild(n){this.children.push(n);return n}
 replaceChildren(...nodes){this.children=nodes}
 setAttribute(k,v){this.attrs[k]=v}
 removeAttribute(k){delete this.attrs[k]}
 addEventListener(type,cb){(this.events??={})[type]=cb}
}
const ids=new Map(["adminSectionNav","adminSectionTabs","adminSectionName","adminSectionDescription","pageTitle","pageSubtitle","sidebar","adminNavShade"].map(id=>[id,new El()]));
const primaries=defaultGroups.map(([key,page])=>{const n=new El();n.dataset.adminGroup=key;n.dataset.page=page;return n});
const menuToggle=new El();
const listeners={};
const document={
 getElementById(id){return ids.get(id)||null},
 querySelectorAll(selector){if(selector==="#sidebar .admin-nav-main")return primaries;return []},
 querySelector(selector){
  if(selector===".mobile-toggle")return menuToggle;
  if(selector==="#content .page.active")return {id:"page-dashboard"};
  if(selector?.startsWith('[data-admin-group="'))return primaries.find(p=>selector.includes(p.dataset.adminGroup))||null;
  return null;
 },
 createElement(){return new El()},
 addEventListener(type,cb){listeners[type]=cb}
};
let lastPage;
const context={window:{addEventListener(){}},document,isLoggedIn:true,
  showPage(page){lastPage=page},console};
vm.runInNewContext(nav,context);
const api=context.window.SMAdminNav;
assert.equal(api.groups.length,6,"Six distinct configured group routes");
for(const [page,group] of [
 ["dashboard","dashboard"],["analytics","dashboard"],["leads","audience"],
 ["users","audience"],["newshub","market"],["news","market"],
 ["notifications","market"],["studioaccess","studio"],["webinar","webinar"],
 ["settings","settings"],["appearance","settings"],["profile","settings"]
]){
 api.onPage(page);
 assert.equal(primaries.filter(n=>n.classSet.has("active")).length,1,"Exactly one active main group for "+page);
 assert.equal(primaries.find(n=>n.classSet.has("active"))?.dataset.adminGroup,group,"Wrong group for "+page);
 assert.equal(ids.get("adminSectionTabs").children.filter(n=>n.className?.includes(" active")).length,1,"One active child tab "+page);
 assert.equal(ids.get("adminSectionNav").hidden,page==="webinar","Only Webinar hides extra tabs; its original 11 internal tabs remain visible");
}
api.openPage("notifications");assert.equal(lastPage,"notifications","Market subtab should open existing handler");
api.openPage("leads");assert.equal(lastPage,"leads","Client directory should remain accessible");
api.toggleSidebar();assert.equal(ids.get("sidebar").classSet.has("open"),true,"Mobile drawer opened");
assert.equal(ids.get("adminNavShade").hidden,false,"Mobile backdrop shown");
api.closeSidebar();assert.equal(ids.get("adminNavShade").hidden,true,"Mobile drawer closed");
console.log("PASS: six premium sections, 12 preserved sub-pages, 20 original panels retained, responsive menu, no data changes");
