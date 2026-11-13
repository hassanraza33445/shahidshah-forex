import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {chromium} from "playwright";
const ORIGIN="http://127.0.0.1:8765";
const sample={
 success:true,page:1,limit:24,last_refresh:"2026-11-13T15:35:00Z",
 items:[
 {id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",title:"Gold extends rally after monetary-policy update",summary:"An attributed sample headline used only for browser tests.",publisher:"Sample Publisher",original_url:"https://example.com/gold",published_at:"2026-11-13T15:30:00Z",category:"Gold",priority:"HOT",priority_reason:"Major macroeconomic development",verification_status:"unverified"},
 {id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",title:"Bitcoin volatility shifts ahead of policy comments",summary:"Sample content only.",publisher:"Test Market News",original_url:"https://example.org/btc",published_at:"2026-11-13T14:00:00Z",category:"Crypto",priority:"WARM",priority_reason:"Market coverage",verification_status:"unverified"}
]};
let failures=0;
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1:8765").pathname);
  const rel=pathname.endsWith("/")?pathname+"index.html":pathname;
  const base=resolve(process.cwd()),file=resolve(base,"."+rel);
  if(!file.startsWith(base+sep)){res.writeHead(403);res.end();return}
  const data=await readFile(file),ext=extname(file);
  res.writeHead(200,{"Content-Type":ext===".html"?"text/html; charset=utf-8":ext===".js"?"application/javascript":ext===".css"?"text/css":"application/octet-stream"});
  res.end(data);
 }catch(e){res.writeHead(404);res.end("Not found")}
});
await new Promise(resolve=>server.listen(8765,"127.0.0.1",resolve));
const browser=await chromium.launch({headless:true});
try{
 const expectedNav=[
  ["/","Home"],["/market-intelligence/","Market Intelligence"],["/content-studio/","AI Studio"],
  ["/ai-tools/","AI Scripts"],["/videos/","Videos"],["/about/","About"]
 ];
 for(const route of ["/","/about/","/course/","/community/","/videos/"]){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:"block"});
   await page.route("**/cdn.jsdelivr.net/**",r=>r.abort());
   await page.route("**/www.googletagmanager.com/**",r=>r.abort());
   await page.goto(ORIGIN+route,{waitUntil:"domcontentloaded",timeout:20000});
   await page.waitForTimeout(220);
   const nav=await page.locator(".learning-nav a").evaluateAll(anchors=>anchors.map(a=>{
    const cs=getComputedStyle(a);return {href:new URL(a.href).pathname,label:a.textContent.trim(),font:cs.fontFamily,size:cs.fontSize,weight:cs.fontWeight};
   }));
   assert.deepEqual(nav.map(x=>[x.href,x.label]),expectedNav,"six header links must remain visible on "+route);
   const sample=nav[0];
   for(const item of nav)assert.deepEqual([item.font,item.size,item.weight],[sample.font,sample.size,sample.weight],"same navigation font across "+route);
   console.log("PASS homepage-style six-link menu",route,width+"px");
   await page.close();
  }
 }
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,serviceWorkers:"block"});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/functions/v1/market-intelligence-api?**",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(sample)}));
  await page.goto(ORIGIN+"/market-intelligence/",{waitUntil:"domcontentloaded",timeout:20000});
  await page.locator("#newsList .news-card").first().waitFor({timeout:10000});
  assert.equal(await page.locator("#newsList .news-card").count(),2,"two headlines rendered");
  assert.equal(await page.getByText("Gold extends rally after monetary-policy update").count()>0,true);
  assert.equal(await page.locator("#newsList a[href='/content-studio/?news=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']").count(),1);
  assert.equal(await page.locator("#newsList a[href='https://example.com/gold']").count(),1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  assert.equal(overflow,false,"No horizontal overflow at "+viewport.width+"px");
  assert.deepEqual(errors,[],"No unexpected browser JavaScript errors");
  await page.close();
  console.log("PASS Market Intelligence "+viewport.width+"px");
 }
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,serviceWorkers:"block"});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2",r=>r.fulfill({status:200,contentType:"application/javascript",body:"globalThis.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};"}));
  await page.goto(ORIGIN+"/content-studio/",{waitUntil:"domcontentloaded",timeout:20000});
  await page.locator("#loginForm").waitFor({timeout:10000});
  assert.equal(await page.locator("#workspace").isVisible(),false,"Private Studio must start behind login");
  assert.equal(await page.locator("#authGate").isVisible(),true);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  assert.equal(overflow,false,"Studio no horizontal overflow at "+viewport.width+"px");
  assert.deepEqual(errors,[],"Studio inline script should not crash without a login");
  await page.close();console.log("PASS AI Studio login gate "+viewport.width+"px");
 }
 for(const mode of ["light","dark"]){
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:"block"});
  await page.addInitScript(value=>{try{localStorage.setItem("smshahid-site-theme",value)}catch(e){}},mode);
  await page.route("**/cdn.jsdelivr.net/**",r=>r.abort());
  await page.route("**/www.googletagmanager.com/**",r=>r.abort());
  await page.goto(ORIGIN+"/learning-hub.html#video",{waitUntil:"domcontentloaded",timeout:20000});
  await page.locator("#banner").waitFor({timeout:9000});
  for(const id of ["video","banner","30days","article","h1","indicator","downloads"]){
   await page.locator('.tab[data-id="'+id+'"]').click();
   await page.waitForFunction(()=>{const x=document.querySelector("#banner");return x&&x.complete&&x.naturalWidth>0},{},{timeout:9000});
   const state=await page.locator("#banner").evaluate(img=>({ok:img.complete&&img.naturalWidth>0,src:new URL(img.currentSrc||img.src).pathname,version:new URL(img.currentSrc||img.src).searchParams.get("v")}));
   assert.equal(state.ok,true,"banner for "+id+" in "+mode+" must load");
   assert.equal(state.src,"/assets/banners/"+id+"-"+mode+".webp","root-relative banner path");
   assert.equal(state.version,"ai-banners-20261114","banner should bypass stale image caches");
   const header=await page.locator("#sm-site-header .brand img").evaluate(img=>img.complete&&img.naturalWidth>0);
   assert.equal(header,true,"brand photo must load after navigation");
  }
  console.log("PASS AI Tools all seven banners, brand image and client navigation in "+mode+" mode");
  await page.close();
 }

 // Homepage header parity: literal navigation, iconography, brand, theme and exact desktop metrics.
 const routes=["/","/about/","/course/","/community/","/videos/","/learning-hub.html","/market-intelligence/","/content-studio/","/social/","/expo/"];
 const labels=["Home","Market Intelligence","AI Studio","AI Scripts","Videos","About"];
 let reference=null;
 for(const theme of ["light","dark"]){
  for(const route of routes){
   const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:"block"});
   await page.addInitScript(t=>{try{localStorage.setItem("smshahid-site-theme",t)}catch{}},theme);
   await page.route("**/cdn.jsdelivr.net/**",r=>r.abort());
   await page.route("**/www.googletagmanager.com/**",r=>r.abort());
   await page.route("**/supabase.co/rest/v1/rpc/get_webinar_public_config",r=>r.fulfill({status:200,contentType:"application/json",body:"{}"}));
   await page.route("**/functions/v1/market-intelligence-api?**",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(sample)}));
   await page.goto(ORIGIN+route,{waitUntil:"domcontentloaded",timeout:20000});
   await page.locator("body > header:not(.site-legacy-header) .learning-nav a").first().waitFor({timeout:9000});
   const m=await page.evaluate(()=>{
    const h=document.querySelector("body > header:not(.site-legacy-header)");
    const brand=h.querySelector(".brand-avatar"),image=brand.querySelector("img"),link=h.querySelector(".learning-nav a");
    const icons=[...h.querySelectorAll(".social-link")],toggle=h.querySelector("#themeToggle"),nav=h.querySelector(".learning-nav"); const row=h.querySelector(".wrap.nav"),rect=row.getBoundingClientRect();
    const css=x=>getComputedStyle(x);
    return {navLabels:[...nav.querySelectorAll("a")].map(x=>x.textContent.trim()),navHrefs:[...nav.querySelectorAll("a")].map(x=>new URL(x.href).pathname),headerHeight:Math.round(h.getBoundingClientRect().height),navFont:css(link).fontFamily,navSize:css(link).fontSize,navWeight:css(link).fontWeight,navPad:css(link).padding,brandWidth:Math.round(brand.getBoundingClientRect().width),brandHeight:Math.round(brand.getBoundingClientRect().height),containerWidth:Math.round(rect.width),containerLeft:Math.round(rect.left),iconWidth:Math.round(icons[0].getBoundingClientRect().width),iconCount:icons.length,svgCount:icons.filter(x=>!!x.querySelector("svg")).length,themeIcon:!!toggle.querySelector("svg"),imageLoaded:image.complete&&image.naturalWidth>0,htmlTheme:document.documentElement.dataset.theme};
   });
   assert.deepEqual(m.navLabels,labels,"exact header link labels on "+route);
   assert.deepEqual(m.navHrefs,["/","/market-intelligence/","/content-studio/","/ai-tools/","/videos/","/about/"],"exact navigation routes on "+route);
   assert.equal(m.iconCount,4,"four identical social icons on "+route);
   assert.equal(m.svgCount,4,"SVG social buttons, no text placeholders on "+route);
   assert.equal(m.themeIcon,true,"theme SVG exists on "+route);
   assert.equal(m.imageLoaded,true,"same brand image loads on "+route);
   assert.equal(m.htmlTheme,theme,"correct shared theme initial state on "+route);
   const legacyVisible=await page.locator(".site-legacy-header").evaluateAll(rows=>rows.some(row=>getComputedStyle(row).display!=="none"));
   assert.equal(legacyVisible,false,"old header must not be visible on "+route);
   if(["/","/about/","/course/","/community/","/videos/"].includes(route))assert.equal(await page.locator("#sm-site-header").count(),0,"original homepage header must be untouched on "+route);
   assert.ok(m.containerWidth>=1090&&m.containerWidth<=1121,"desktop header remains centered within 1120px on "+route+": width "+m.containerWidth); assert.ok(Math.abs(m.containerLeft-(1440-m.containerWidth)/2)<3,"header centered horizontally on "+route+": left "+m.containerLeft);
   const visual={headerHeight:m.headerHeight,navFont:m.navFont,navSize:m.navSize,navWeight:m.navWeight,navPad:m.navPad,brandWidth:m.brandWidth,brandHeight:m.brandHeight,iconWidth:m.iconWidth,containerWidth:m.containerWidth,containerLeft:m.containerLeft};
   if(route==="/"){reference=visual}else assert.deepEqual(visual,reference,"header visual metrics must EXACTLY match homepage at "+route+" in "+theme);
   await toggleTheme(page,m.htmlTheme);
   console.log("PASS pixel-metric header parity",route,theme,JSON.stringify(visual));
   await page.close();
  }
 }
 // Mobile viewport: all pages retain navigation, header theme switch and no unexpected clipping of the shared header.
 for(const route of routes){
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:"block"});
  await page.addInitScript(()=>{try{localStorage.setItem("smshahid-site-theme","light")}catch{}});
  await page.route("**/cdn.jsdelivr.net/**",r=>r.abort());
  await page.route("**/www.googletagmanager.com/**",r=>r.abort());
  await page.route("**/supabase.co/rest/v1/rpc/get_webinar_public_config",r=>r.fulfill({status:200,contentType:"application/json",body:"{}"}));
  await page.route("**/functions/v1/market-intelligence-api?**",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(sample)}));
  await page.goto(ORIGIN+route,{waitUntil:"domcontentloaded",timeout:20000});
  const el=page.locator("body > header:not(.site-legacy-header)").first();
  await el.waitFor({timeout:9000});
  const visible=await el.evaluate(h=>{let n=h.querySelector(".learning-nav"),row=h.querySelector(".wrap.nav"),rect=row.getBoundingClientRect();return {display:getComputedStyle(h).display,links:n.querySelectorAll("a").length,navDisplay:getComputedStyle(n).display,height:h.getBoundingClientRect().height,hrefs:[...n.querySelectorAll("a")].map(a=>a.href),logo:h.querySelector("img").naturalWidth>0,width:rect.width,left:rect.left}});
  assert.equal(visible.links,6,"mobile six-link header "+route);
  assert.equal(visible.logo,true,"mobile logo loads "+route);
  assert.notEqual(visible.display,"none","mobile header visible "+route);
  assert.notEqual(visible.navDisplay,"none","mobile nav visible "+route);
  assert.ok(visible.height>30&&visible.height<180,"mobile header stable height "+route);
  assert.ok(visible.left>=0&&visible.left<=12&&visible.width>=375&&visible.width<=390,"mobile header centered + contained on "+route);
  console.log("PASS mobile shared header",route,visible.height);
  await page.close();
 }
 async function toggleTheme(page,before){
  await page.locator("body > header:not(.site-legacy-header) #themeToggle").first().click();
  await page.waitForFunction(previous=>document.documentElement.dataset.theme!==previous,before,{timeout:3500});
  const after=await page.evaluate(()=>document.documentElement.dataset.theme);
  assert.equal(after,before==="dark"?"light":"dark","theme toggle switches on "+page.url());
 }

 for(const [route,pathPart] of [["/ai-banner-scripts/","/learning-hub.html#banner"],["/expo.html","/expo/"],["/webinar-admin/","/webinar-admin.html"]]){
  const page=await browser.newPage({serviceWorkers:"block"});
  await page.route("**/cdn.jsdelivr.net/**",r=>r.abort());
  await page.route("**/www.googletagmanager.com/**",r=>r.abort());
  await page.goto(ORIGIN+route,{waitUntil:"domcontentloaded",timeout:20000});
  const destination=u=>u.href.includes(pathPart)||(route==="/ai-banner-scripts/"&&u.pathname==="/ai-banner-scripts");
  await page.waitForTimeout(850);
  const current=new URL(page.url());
  console.log("Alias navigation observed:",route,current.pathname,current.hash);
  assert.equal(destination(current)||((route==="/ai-banner-scripts/")&&current.pathname.startsWith("/ai-")),true,"alias must reach central content");
  await page.close();console.log("PASS legacy redirect "+route);
 }
}catch(e){failures++;console.error("Browser smoke FAILED:",e.stack||e)}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
if(failures)process.exit(1);
console.log("All browser smoke cases passed.");
