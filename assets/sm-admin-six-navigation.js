/* Six premium admin sections.
 * Navigation-only integration; all original module handlers remain in place.
 * Never grants access, never edits subscriptions, users or saved records.
 */
(()=>{
 "use strict";
 const GROUPS=[
  {id:"dashboard",title:"Dashboard",summary:"Platform overview and consolidated reporting",
   defaultPage:"dashboard",tabs:[["dashboard","Overview"],["analytics","Insights"]]},
  {id:"audience",title:"Clients & Users",summary:"All client sources, registered accounts and exports",
   defaultPage:"leads",tabs:[["leads","All Clients & Leads"],["users","Registered Accounts"]]},
  {id:"market",title:"Market Intelligence",summary:"Global news, published posts and push notifications",
   defaultPage:"newshub",tabs:[["newshub","World News Hub"],["news","News Posts"],["notifications","Notifications"]]},
  {id:"studio",title:"AI Studio",summary:"Creator permissions and AI content workspace",
   defaultPage:"studioaccess",tabs:[["studioaccess","Access Management"]],launch:{label:"Open AI Studio ↗",url:"/app/?tab=studio"}},
  {id:"webinar",title:"Webinar Management",summary:"Registrations, analytics, reviews, event settings and downloads",
   defaultPage:"webinar",tabs:[["webinar","Webinar Workspace"]]},
  {id:"settings",title:"Settings",summary:"Account settings, branding and platform configuration",
   defaultPage:"settings",tabs:[["settings","Platform"],["appearance","Appearance"],["profile","Admin Profile"]]}
 ];
 const byPage=new Map(GROUPS.flatMap(group=>group.tabs.map(([page])=>[page,group])));
 const $=id=>document.getElementById(id);
 function openPage(page){
   if(!byPage.has(page)||typeof showPage!=="function")return;
   if(typeof isLoggedIn!=="undefined"&&isLoggedIn!==true)return;
   const nav=document.querySelector('[data-admin-group="'+byPage.get(page).id+'"]');
   showPage(page,nav);
 }
 function renderTabs(group,page){
   const container=$("adminSectionTabs");
   if(!container)return;
   container.replaceChildren();
   for(const [id,label] of group.tabs){
     const button=document.createElement("button");button.type="button";
     button.className="admin-section-tab"+(page===id?" active":"");
     button.textContent=label;
     button.setAttribute("aria-current",page===id?"page":"false");
     button.addEventListener("click",()=>openPage(id));
     container.appendChild(button);
   }
   if(group.launch){
     const link=document.createElement("a");
     link.className="admin-section-tab admin-section-launch";
     link.href=group.launch.url;link.target="_blank";link.rel="noopener noreferrer";
     link.textContent=group.launch.label;
     link.title="Opens the existing authenticated AI Studio workspace";
     container.appendChild(link);
   }
 }
 function onPage(page){
   const group=byPage.get(page);
   if(!group)return;
   document.querySelectorAll("#sidebar .admin-nav-main").forEach(node=>{
     const active=node.dataset.adminGroup===group.id;
     node.classList.toggle("active",active);
     if(active)node.setAttribute("aria-current","page");
     else node.removeAttribute("aria-current");
   });
   const header=$("adminSectionNav");
   if(header){
     header.hidden=group.id==="dashboard";
     $("adminSectionName").textContent=group.title;
     $("adminSectionDescription").textContent=group.summary;
     renderTabs(group,page);
   }
   // Header makes the six group identities consistent on all existing pages.
   const pageTitle=$("pageTitle");
   const subtitle=$("pageSubtitle");
   if(pageTitle)pageTitle.textContent=group.id==="dashboard"?"Admin Dashboard":group.title;
   if(subtitle){
     const match=group.tabs.find(([id])=>id===page);
     subtitle.textContent=(match?match[1]+" · ":"")+group.summary;
   }
   closeSidebar();
 }
 function closeSidebar(){
   const side=$("sidebar");side?.classList.remove("open");
   const shade=$("adminNavShade");if(shade)shade.hidden=true;
   const menuToggle=document.querySelector(".mobile-toggle");
   if(menuToggle)menuToggle.setAttribute("aria-expanded","false");
 }
 function toggleSidebar(){
   const side=$("sidebar");if(!side)return;
   const opened=side.classList.toggle("open");
   const shade=$("adminNavShade");if(shade)shade.hidden=!opened;
   const menuToggle=document.querySelector(".mobile-toggle");
   if(menuToggle)menuToggle.setAttribute("aria-expanded",String(opened));
 }
 document.addEventListener("DOMContentLoaded",()=>{
   $("adminNavShade")?.addEventListener("click",closeSidebar);
   window.addEventListener("keydown",event=>{if(event.key==="Escape")closeSidebar()});
   // A new user can still open existing #webinar / #leads / #studio-access links.
   const active=document.querySelector("#content .page.active");
   if(active)onPage(active.id.replace(/^page-/,""));
 });
 window.SMAdminNav={groups:GROUPS,onPage,openPage,closeSidebar,toggleSidebar};
})();
