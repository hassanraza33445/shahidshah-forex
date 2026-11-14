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
  assert.equal(await p.locator("#studioAccessState").isVisible(),true,"Access rules are explained in the original dashboard");
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
  await p.locator('.mobile-dock button[data-section="studio"]').click();
  await p.waitForFunction(()=>document.querySelector("#studioAccessState")?.hidden===true,{},{timeout:11000});
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
  await p.locator("#openMenu").click();await p.locator('#appSidebar button[data-section="library"]').click();
  assert.equal(await p.locator("#unifiedStudioFrame").count(),1,"One Studio iframe is reused for private library");
  await editor.locator("#page-projects.active").waitFor({timeout:9000});
  assert.match(await p.locator("#studioTitle").innerText(),/My Content/);
  await p.locator('.mobile-dock button[data-section="home"]').click();
  await p.locator('#view-home button[data-section="studio"][data-studio-page="record"]').click();
  await editor.locator("#page-record.active").waitFor({timeout:9000});
  await p.locator("#openMenu").click();await p.locator('#appSidebar button[data-section="markets"]').click();
  await p.locator('#view-markets button[data-market-page="calendar"]').click();
  await p.waitForFunction(()=>document.querySelector("#marketModuleFrame")?.getAttribute("src")?.includes("economic-calendar"),{},{timeout:9000});
  assert.equal(await p.locator("#marketModuleFrame").count(),1);
  await p.locator("#openMenu").click();await p.locator('#appSidebar button[data-section="tools"]').click();
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
