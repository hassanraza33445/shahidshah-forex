import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {chromium} from "playwright";
const HOST="http://127.0.0.1:8791",root=process.cwd();
const mime={".html":"text/html",".js":"application/javascript",".css":"text/css",".json":"application/json",".webp":"image/webp",".jpg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon"};
const server=createServer(async(req,res)=>{
 let path=(req.url||"/").split("?")[0].split("#")[0];
 try{path=decodeURIComponent(path)}catch{res.writeHead(400);res.end();return}
 if(path==="/")path="/index.html";else if(path.endsWith("/"))path+="index.html";
 let file=resolve(root,"."+path);
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
 try{const data=await readFile(file);res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});res.end(data)}
 catch{res.writeHead(404);res.end("Not found")}
});
await new Promise(r=>server.listen(8791,"127.0.0.1",r));
const sbFake=String.raw`
window.supabase={createClient:()=>({
 auth:{
  async getUser(){let ok=localStorage.getItem("SM_QA_SIGNED_IN")==="true";return {data:{user:ok?{id:"11111111-1111-4111-8111-111111111111",email:"demo@example.test",email_confirmed_at:"2026-11-13T10:00:00Z",user_metadata:{full_name:"Demo QA User"}}:null},error:null}},
  async getSession(){let ok=localStorage.getItem("SM_QA_SIGNED_IN")==="true";return {data:{session:ok?{access_token:"test-jwt"}:null}}},
  async signInWithPassword(o){if(o.password!=="StrongPass123!")return {error:new Error("Invalid credentials"),data:{session:null}};localStorage.setItem("SM_QA_SIGNED_IN","true");return {data:{session:{access_token:"test-jwt"}},error:null}},
  async signUp(o){window.__signupData=o;return {data:{session:null},error:null}},
  async signInWithOAuth(o){window.__googleOAuth=o;return {data:{url:"https://accounts.google.com/"},error:null}},
  async signOut(){localStorage.removeItem("SM_QA_SIGNED_IN");return {error:null}},
  onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}
 },
 from(table){let query={};
 const builder={
  select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:table==="member_mentorship_applications"?JSON.parse(localStorage.getItem("SM_QA_APPLICATIONS")||"[]"):[],error:null})},
  in(){return this},maybeSingle(){return Promise.resolve({data:table==="profiles"?{full_name:"Demo QA User",email:"demo@example.test",is_admin:false,avatar_url:null}:table==="content_access"&&localStorage.getItem("SM_QA_STUDIO_ACCESS")==="true"?{enabled:true,role:"creator"}:null,error:null})},
  insert(payload){if(table==="member_mentorship_applications"){window.__submittedMentorship=payload;localStorage.setItem("SM_QA_APPLICATIONS",JSON.stringify([{id:"22222222-2222-4222-8222-222222222222",status:"pending",created_at:new Date().toISOString(),interest:payload.interest}]))}return Promise.resolve({data:null,error:null})}
 };return builder}
})};
`;
const news={success:true,items:[{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",title:"Official Gold market announcement",summary:"Source-linked sample for tests only",original_url:"https://www.bls.gov/",publisher:"BLS",published_at:"2026-11-13T12:00:00Z",category:"Gold",priority:"HOT"}]};
const calendar={success:true,items:[{id:"22222222-aaaa-4aaa-8aaa-222222222222",title:"U.S. CPI",category:"Inflation",scheduled_at:new Date(Date.now()+2*86400000).toISOString(),impact:"HIGH",source_url:"https://www.bls.gov/"}]};
const alerts={success:true,items:[{id:"33333333-aaaa-4aaa-8aaa-333333333333",kind:"breaking_news",title:"Gold market alert",topic:"Gold",trust_status:"unverified",created_at:new Date().toISOString()}],delivery:"in_app_only"};
const browser=await chromium.launch({headless:true});
async function newPage(width=390,authenticated=false){
 const p=await browser.newPage({viewport:{width,height:860},serviceWorkers:"block"});
 if(authenticated)await p.addInitScript(()=>{localStorage.setItem("SM_QA_SIGNED_IN","true");localStorage.setItem("SM_QA_STUDIO_ACCESS","true")});
 await p.route("**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2**",r=>r.fulfill({status:200,contentType:"application/javascript",body:sbFake}));
 await p.route("**/functions/v1/market-intelligence-api?**",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(news)}));
 await p.route("**/functions/v1/economic-calendar-api?**",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(calendar)}));
 await p.route("**/functions/v1/market-notifications-api?**",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(alerts)}));
 await p.route("**/fonts.googleapis.com/**",r=>r.abort());
 await p.route("**/www.googletagmanager.com/**",r=>r.abort());
 return p;
}
try{
 {
  const p=await newPage(390,false);
  await p.goto(HOST+"/market-intelligence/",{waitUntil:"domcontentloaded"});
  await p.waitForURL(/\/auth\/\?next=/,{timeout:12000});
  assert.equal(await p.locator("#authForm").count(),1,"Guest sent to Login/Sign Up");
  assert((await p.locator("#signUpTab").isVisible()),"Sign Up is clearly visible");
  assert.equal(new URL(p.url()).searchParams.get("next"),"/market-intelligence/");
  console.log("PASS guest route guarded and Login/Sign Up presented");
  await p.close();
 }
 {
  const p=await newPage(390,false);
  await p.goto(HOST+"/auth/?next=%2Fapp%2F%3Ftab%3Dstudio",{waitUntil:"domcontentloaded"});
  await p.locator("#signUpTab").click();
  assert.equal(await p.locator("#fullname").isVisible(),true,"Sign-up full name");
  await p.locator("#signInTab").click();
  await p.locator("#email").fill("demo@example.test");
  await p.locator("#password").fill("StrongPass123!");
  await p.locator("#submitBtn").click();
  try{await p.waitForURL(/\/app\/\?tab=studio/,{timeout:8000})}
  catch(e){const d=await p.evaluate(()=>({url:location.href,loginState:localStorage.getItem("SM_QA_SIGNED_IN"),
   authStatus:document.querySelector("#authStatus")?.textContent,formMode:document.querySelector("#authTitle")?.textContent,
   email:document.querySelector("#email")?.value,button:document.querySelector("#submitBtn")?.disabled}));
   console.log("AUTH_TEST_DIAGNOSTIC "+JSON.stringify(d));throw e}
  await p.locator("#view-studio.active").waitFor({timeout:9000});
  assert.equal(await p.locator("#view-home.active").count(),0);
  assert.equal(await p.locator(".mobile-dock button").count(),5);
  await p.waitForFunction(()=>document.querySelector("#studioAccessState")?.textContent.includes("restricted"),{},{timeout:9000});
  assert.equal(await p.locator("#unifiedStudioFrame").count(),0,"Unassigned users cannot load the creator frame");
  assert.equal(await p.locator("#studioAccessState").isVisible(),true,"Restricted Studio access remains visible");
  assert.equal(await p.locator("#studioSubnav").isVisible(),false,"Unauthorized users do not see clickable creator tabs");
  assert.equal(await p.locator("#studioAccessState .studio-gate-feature").count(),4,"Premium restricted workspace previews four tools without unlocking them");
  assert.equal(await p.locator("#studioAccessState .studio-gate-feature button").count(),0,"Preview cards never bypass access");
  assert.match(await p.locator("#studioGateBadge").innerText(),/APPROVAL REQUIRED/,"Permission state is clearly labeled");
  assert.equal(await p.locator("#studioRecheckAccess").isEnabled(),true,"Access can be rechecked safely");
  assert.equal(await p.locator("#studioHeroTagline").innerText(),"Create smarter. Publish better.");
  await p.locator("#studioRecheckAccess").click();
  await p.waitForFunction(()=>document.querySelector("#studioGateBadge")?.textContent==="APPROVAL REQUIRED",{},{timeout:9000});
  assert.equal(await p.locator("#unifiedStudioFrame").count(),0,"Rechecking without admin approval does not unlock Studio");
  const gateContrast=await p.locator("#studioGateTitle").evaluate(el=>({color:getComputedStyle(el).color,size:parseFloat(getComputedStyle(el).fontSize)}));
  assert(gateContrast.size>=19,"Restricted access heading is readable on mobile");
  await p.locator("#memberThemeToggle").click();
  assert.equal(await p.locator("html").getAttribute("data-theme"),"dark","Dark theme applies to locked Studio");
  assert.equal(await p.locator("#studioGateTitle").isVisible(),true,"Locked Studio heading stays readable in dark theme");
  await p.locator("#memberThemeToggle").click();
  assert.equal(await p.locator("html").getAttribute("data-theme"),"light","Studio returns to light theme");
  const noOverflow=await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2);
  assert.equal(noOverflow,true,"Mobile app has no horizontal overflow");
  console.log("PASS sign-in, redirect, role-based Studio lock and no mobile overflow");
  await p.close();
 }
 {
  const p=await newPage(1440,true);
  const errors=[];p.on("pageerror",e=>errors.push(e.message));
  await p.goto(HOST+"/app/",{waitUntil:"domcontentloaded"});
  await p.locator("#view-home.active").waitFor({timeout:11000});
  await p.locator("#dashboardWatchlist .watchlist-row").first().waitFor({timeout:11000});
  await p.locator("#dashboardEventsList .dashboard-event").first().waitFor({timeout:11000});
  assert.equal(await p.locator(".dashboard-layout .dashboard-primary").count(),1,"Premium dashboard has a main intelligence column");
  assert.equal(await p.locator(".dashboard-layout .dashboard-right").count(),1,"Premium dashboard has its own watchlist/events rail");
  assert.equal(await p.locator(".dashboard-metrics .metric").count(),4,"All four grounded KPI cards are displayed");
  assert.equal(await p.locator("#view-home .quick-grid .tool-card").count(),5,"Five premium tool shortcuts are available");
  assert.match(await p.locator("#dashboardGreeting").innerText(),/Demo/,"Personalized greeting is based on signed-in user");
  assert.equal(await p.locator(".dashboard-watchlist").innerText().then(v=>v.includes("not live quotes")),true,"Watchlist must not imply a live price feed");
  assert.equal(await p.locator("#bootScreen").isVisible(),false,"Successful login must hide the boot screen");
  assert.equal(await p.locator(".side-brand .side-portrait").count(),1,"Sidebar displays the homepage portrait");
  assert.equal(await p.locator("#memberThemeToggle").count(),1,"Dashboard theme switch exists");
  assert.equal(await p.locator("html").getAttribute("data-theme"),"light","Member theme defaults to light");
  await p.locator("#memberThemeToggle").click();
  assert.equal(await p.locator("html").getAttribute("data-theme"),"dark","Theme switch enables dark");
  await p.locator("#memberThemeToggle").click();
  assert.equal(await p.locator("html").getAttribute("data-theme"),"light","Theme switch returns to light");
  assert.equal(await p.locator(".app-sidebar").count(),1);
  assert.equal(await p.locator(".desktop-header-links").count(),0,"No second desktop navigation");
  assert.equal(await p.locator(".workspace-header-label").count(),1,"Unified workspace header");
  assert.equal(await p.locator(".side-links .ui-icon").count(),9,"All sidebar sections have consistent outline SVG icons");
  await p.locator('.side-links button[data-section="markets"]').click();
  await p.locator("#miFeatureLead .news-card").waitFor({timeout:9000});
  assert.equal(await p.locator("#miTotalStories").innerText(),"1","Editorial desk reflects actual API headline count");
  assert.equal(await p.locator("#miFeatureLead .news-visual-gold").count(),1,"Featured Gold story gets relevant illustration");
  assert.equal(await p.locator(".mi-png-grid").count(),1,"Reference-style editorial grid exists");
  const layout=await p.locator(".mi-png-grid").evaluate(el=>({
   columns:getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
   summaryTop:el.querySelector(".mi-summary-strip").getBoundingClientRect().top,
   railTop:el.querySelector(".mi-sidebar").getBoundingClientRect().top
  }));
  assert.equal(layout.columns,2,"Desktop reference puts market rail alongside editorial content");
  assert(Math.abs(layout.summaryTop-layout.railTop)<16,"Market rail must start alongside KPI strip");
  assert.equal(await p.locator(".mi-feature-lead .news-card .sm-news-read-button").count(),1,"Featured story retains on-site details");
  assert.equal(await p.locator("#miPriorityStories").innerText(),"1","Featured count reflects selected stories, not fabricated HOT flags");
  assert.equal(await p.locator(".mi-coverage-row .mi-topic-symbol").count(),4,"Market focus rows display topic icons");
  assert.equal(await p.locator("#miEventsList .mi-event").count(),1,"Economic calendar is visible in market sidebar");
  assert.equal(await p.locator("#miCoverageList .mi-coverage-row").count(),4,"Four categories show real feed coverage");
  await p.locator('#miFeatureLead .sm-news-read-button').click();
  await p.locator("#smNewsReader[open]").waitFor({timeout:9000});
  assert.match(await p.locator("#smNewsReaderTitle").innerText(),/Official Gold market announcement/);
  assert.equal(await p.locator("#smNewsReader a[href^='https://']").count(),0,"Article stays on S M Shahid Shah");
  await p.keyboard.press("Escape");
  await p.locator("#miSearch").fill("never-matching-term");
  assert.equal(await p.locator("#miResultCount").innerText(),"0 matching headlines","Search filters actual source data");
  await p.locator("#miSearch").fill("");
  await p.locator("#miFeatureLead .news-card").waitFor({timeout:5000});
  await p.locator('.side-links button[data-section="home"]').click();
  console.log("PASS premium Market Intelligence: featured story, search, source-linked reader, coverage and calendar");
  await p.locator('.side-links button[data-section="profile"]').click();
  await p.locator("#view-profile.active").waitFor({timeout:5000});
  assert.equal(await p.locator("#profileDisplayName").inputValue(),"Demo QA User","Profile name is prefilled from the authenticated account");
  await p.locator("#profileDarkTheme").click();
  assert.equal(await p.locator("html").getAttribute("data-theme"),"dark");
  await p.locator("#profileLightTheme").click();
  assert.equal(await p.locator("html").getAttribute("data-theme"),"light");
  assert.equal(await p.locator("#profileLightTheme").getAttribute("aria-pressed"),"true");
  await p.locator('.side-links button[data-section="mentorship"]').click();
  assert.equal(await p.locator(".mentorship-highlight strong").evaluate(el=>getComputedStyle(el).color),"rgb(54, 39, 27)","Premium champagne mentor banner has a readable dark headline");

  assert.equal(await p.locator("#view-mentorship .vip-process-strip>div").count(),3,"Three mentorship application stages present");
  assert.equal(await p.locator("#view-mentorship .vip-mentor-hero").isVisible(),true,"Mentorship VIP hero visible");
  await p.locator('.side-links button[data-section="tools"]').click();
  assert.equal(await p.locator("#view-tools .vip-tools-grid .tool-list-row").count(),6,"Six premium Prompt Tools available");
  assert.equal(await p.locator("#view-tools .vip-tools-hero").isVisible(),true);
  await p.locator('#view-tools button[data-tool="banner"]').click();
  assert.match(await p.locator("#toolModuleFrame").getAttribute("src"),/learning-hub.*embedded=1#banner/);
  await p.locator("#closeToolModule").click();
  await p.locator('.side-links button[data-section="library"]').click();
  assert.equal(await p.locator("#view-studio.studio-library-mode.active").count(),1,"My Content shares private Studio");
  assert.equal(await p.locator("#libraryActionBar").isVisible(),true,"Approved creator retains library actions");
  await p.locator('.side-links button[data-section="notifications"]').click();
  assert.equal(await p.locator("#view-notifications .vip-notification-benefits>div").count(),3,"Three grounded alert groups");
  await p.locator('.side-links button[data-section="mentorship"]').click();
  console.log("PASS VIP Tools, Mentorship, My Content and Notifications navigation");
  console.log("PASS premium icons, profile preferences and mentorship headline contrast");

  assert.match(await p.locator("#greeting").innerText(),/Demo/);
  await p.locator('button[data-section="mentorship"]').first().click();
  await p.locator("#mentorPhone").fill("+60123456789");
  await p.locator("#mentorGoals").fill("I want to learn market analysis and improve brokerage business strategy.");
  await p.locator("#mentorSubmit").click();
  await p.waitForFunction(()=>Boolean(window.__submittedMentorship),{},{timeout:8000});
  assert.equal(await p.evaluate(()=>window.__submittedMentorship.interest),"Forex Trading");
  assert.equal(errors.length,0,"No desktop JavaScript errors");
  console.log("PASS desktop premium sidebar, real data loading and mentorship submission");
  await p.close();
 }
 {
  const p=await newPage(390,true);
  const errors=[];p.on("pageerror",e=>errors.push(e.message));
  await p.goto(HOST+"/app/",{waitUntil:"domcontentloaded"});
  await p.locator("#view-home.active").waitFor({timeout:11000});
  await p.locator("#dashboardWatchlist .watchlist-row").first().waitFor({timeout:11000});
  assert.equal(await p.locator(".dashboard-home .feature-hero").isVisible(),true,"Luxury dashboard hero renders on mobile");
  assert.equal(await p.locator(".dashboard-home .market-strip").isVisible(),true,"Market snapshot is accessible on mobile");
  assert.equal(await p.locator("#homeHeadlines .news-visual").count(),1,"Featured news includes its own premium visual");
  assert.equal(await p.locator(".dashboard-events .dashboard-event").count(),1,"Source-backed economic event appears in mobile dashboard");
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),true,"Premium dashboard has no horizontal overflow at 390px");
  await p.locator('.mobile-dock button[data-section="studio"]').click();
  await p.waitForFunction(()=>document.querySelector("#studioAccessState")?.hidden===true,{},{timeout:11000});
  assert.equal(await p.locator("#studioAccessState").isVisible(),false,"Approved users do not see the locked preview");
  assert.equal(await p.locator("#studioSubnav").isVisible(),true,"Approved users retain Studio tools navigation");
  assert.equal(await p.locator(".studio-premium-heading").isVisible(),true,"Premium Studio hero is present for authorized creators");
  const editor=p.frameLocator("#unifiedStudioFrame");
  await editor.locator("#page-create.active").waitFor({timeout:14000});
  assert.equal(await editor.locator('#duration option').allTextContents().then(v=>v.includes("45 seconds")),true,"Real AI creator supports 45 sec");
  assert.equal(await editor.locator(".side").isVisible(),false,"No duplicate Studio sidebar in embedded mode");
  assert.equal(await editor.locator(".mobile-bottom").isVisible(),false,"No duplicate Studio mobile dock");
  assert.equal(await editor.locator(".sm-private-dock").count(),0,"Embedded route does not inject a second dock");
  assert.equal(await editor.locator("html.sm-embedded").count(),1,"Studio is in embedded mode");
  await p.locator('#studioSubnav [data-studio-page="record"]').click();
  await editor.locator("#page-record.active").waitFor({timeout:9000});
  assert.equal(await editor.locator("#startRecording").count(),1,"Creator voice recording is available");
  await p.locator("#openMenu").click();
  await p.locator('#appSidebar button[aria-label="Open AI Scripts generator"]').click();
  await p.waitForURL(u=>u.pathname==="/app/"&&u.searchParams.get("studio")==="create",{timeout:8000});
  await editor.locator("#page-create.active").waitFor({timeout:9000});
  assert.equal(await p.locator('#appSidebar button[aria-label="Open AI Scripts generator"].active').count(),1,"AI Scripts shortcut is active");
  assert.equal(await p.locator('#appSidebar button[data-studio-page="dashboard"].active').count(),0,"Studio overview is not simultaneously active");
  console.log("PASS mobile AI Scripts sidebar opens actual creator without leaving app");
  await p.locator("#openMenu").click();await p.locator('#appSidebar button[data-section="library"]').click();
  assert.equal(await p.locator("#unifiedStudioFrame").count(),1,"One Studio iframe is reused for private library");
  await editor.locator("#page-projects.active").waitFor({timeout:9000});
  assert.match(await p.locator("#studioTitle").innerText(),/My Content/);
  await p.locator('.mobile-dock button[data-section="home"]').click();
  await p.locator('#view-home button[data-section="studio"][data-studio-page="dashboard"]').first().click();
  await p.locator('#studioSubnav [data-studio-page="record"]').click();
  await editor.locator("#page-record.active").waitFor({timeout:9000});
  await p.locator("#openMenu").click();await p.locator('#appSidebar button[data-section="markets"]').click();
  await p.locator("#miFeatureLead .news-card").waitFor({timeout:10000});
  assert.equal(await p.locator(".mi-feature-grid").isVisible(),true,"Mobile featured news area appears");
  const mobileLayout=await p.locator(".mi-png-grid").evaluate(el=>({
   columns:getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
   shellWidth:el.getBoundingClientRect().width
  }));
  assert.equal(mobileLayout.columns,1,"Mobile reference stacks market sidebar below news");
  assert(mobileLayout.shellWidth<=p.viewportSize().width,"Market layout must fit mobile viewport");
  assert.equal(await p.locator("#miCoverageList .mi-coverage-row").count(),4,"Mobile coverage panel shows all categories");
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),true,"Premium Market Intelligence has no mobile horizontal overflow");
  await p.locator('#view-markets .mi-module-tabs button[data-market-page="calendar"]').click();
  await p.waitForFunction(()=>document.querySelector("#marketModuleFrame")?.getAttribute("src")?.includes("economic-calendar"),{},{timeout:9000});
  assert.equal(await p.locator("#marketModuleFrame").count(),1);
  await p.locator("#openMenu").click();await p.locator('#appSidebar button[data-section="tools"]').click();
  assert.equal(await p.locator("#view-tools .vip-tools-grid .tool-list-row").count(),6,"All VIP tools render on mobile");
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),true,"No mobile overflow in VIP tools");
  await p.locator('#view-tools button[data-tool="article"]').click();
  assert.match(await p.locator("#toolModuleFrame").getAttribute("src"),/learning-hub.*embedded=1#article/);
  await p.locator("#closeToolModule").click();
  assert.equal(await p.locator("#toolModuleArea").isVisible(),false);
  await p.locator("#openMenu").click();await p.locator('#appSidebar button[data-section="notifications"]').click();
  await p.waitForFunction(()=>document.querySelector("#noticeFrame")?.getAttribute("src")?.includes("notifications"),{},{timeout:9000});
  assert.equal(await p.locator(".mobile-dock").count(),1);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),true,"No mobile horizontal overflow with modules");
  assert.equal(errors.length,0,"No member or nested module JavaScript exceptions: "+JSON.stringify(errors));
  console.log("PASS unified mobile tabs, authorized real AI studio, 45 seconds, voice, library, calendar, prompt tool and notifications");
  await p.close();
 }
 {
  const guest=await newPage(390,false);
  await guest.goto(HOST+"/ai-video-scripts/",{waitUntil:"domcontentloaded"});
  await guest.waitForURL(u=>u.pathname==="/auth/"&&u.searchParams.get("next")==="/app/?tab=studio&studio=create",{timeout:12000});
  assert.equal(await guest.locator("#signInTab").isVisible(),true,"Guest AI Scripts route opens Login/Sign Up, not the landing page");
  await guest.close();
  console.log("PASS guest AI Scripts shortcut retains direct post-login destination");
 }
 {
  const member=await newPage(1440,true);
  await member.goto(HOST+"/app/?tab=studio&studio=create",{waitUntil:"domcontentloaded"});
  await member.locator("#view-studio.active").waitFor({timeout:11000});
  await member.frameLocator("#unifiedStudioFrame").locator("#page-create.active").waitFor({timeout:14000});
  assert.equal(await member.locator('#studioSubnav button[data-studio-page="create"].active').count(),1,"Bookmarked AI Scripts opens creator");
  await member.close();
  console.log("PASS signed-in bookmarked AI Scripts opens actual generator");
 }
 for(const route of ["/economic-calendar/","/market-reaction/","/notifications/","/learning-hub.html","/content-studio/"]){
  const guest=await newPage(390,false);
  await guest.goto(HOST+route,{waitUntil:"domcontentloaded"});
  await guest.waitForURL(/\/auth\/\?next=/,{timeout:12000});
  assert.equal(await guest.locator("#authForm").count(),1,"Protected route login "+route);
  await guest.close();
 }
 console.log("PASS guest access gate on all internal areas");
 {
  const p=await newPage(390,true);
  await p.goto(HOST+"/economic-calendar/",{waitUntil:"domcontentloaded"});
  await p.waitForFunction(()=>document.documentElement.classList.contains("sm-member-allowed"),{},{timeout:10000});
  assert.equal(await p.locator(".sm-private-dock a").count(),5);
  const x=await p.locator("body > header:not(.site-legacy-header) .wrap.nav").first().boundingBox();
  assert(x&&x.width<=390,"Original shared header fits mobile member routes");
  console.log("PASS authenticated member internal navigation and centered header");
  await p.close();
 }
}finally{await browser.close();server.close()}
