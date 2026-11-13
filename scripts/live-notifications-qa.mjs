import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
let tests=0;
try{
 for(const origin of ["https://www.smshahidshah.com","https://smshahidshah.com"]){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:"block"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message.slice(0,150)));
   try{
    const r=await page.goto(origin+"/notifications/?qa=20261114v1",{waitUntil:"domcontentloaded",timeout:23000});
    assert.equal(r?.status(),200);
    await page.waitForFunction(()=>Number(document.querySelector("#allCount")?.textContent)>0,{},{timeout:18000});
    const metric=await page.evaluate(()=>{
     const h=document.querySelector("#sm-site-header"),row=h.querySelector(".wrap.nav").getBoundingClientRect();
     return {count:Number(document.querySelector("#allCount")?.textContent),
      unverified:document.querySelectorAll("#noticeList .tag.unverified").length,
      news:document.querySelectorAll("#noticeList .notice").length,
      headerLinks:h.querySelectorAll(".learning-nav a").length,
      socialIcons:h.querySelectorAll(".social-link svg").length,
      image:h.querySelector(".brand-avatar img").naturalWidth,
      headerWidth:Math.round(row.width),left:Math.round(row.left),right:Math.round(innerWidth-row.right),
      pushEnabled:document.body.innerText.includes("Browser/mobile push notifications are not active yet.")
     };
    });
    assert(metric.count>0&&metric.news>0);
    assert(metric.unverified>0,"Unverified headlines must be explicitly identified");
    assert.equal(metric.headerLinks,6);
    assert.equal(metric.socialIcons,4);
    assert(metric.image>0);
    assert(Math.abs(metric.left-metric.right)<=2,"Header must remain centered");
    if(width===1440)assert.equal(metric.headerWidth,1120);
    assert(metric.pushEnabled,"Cannot pretend browser push is enabled");
    assert.equal(errors.length,0,"No browser JavaScript errors");
    await page.locator("#tabHot").click();
    assert((await page.locator("#noticeList .notice").count())>0,"HOT filter works");
    await page.locator("#tabEvents").click();
    assert.match(await page.locator("#noticeList").innerText(),/No alerts match this filter|Official/i);
    await page.locator("#tabInbox").click();
    assert.match(await page.locator("#noticeList").innerText(),/Sign in/i);
    await page.locator("#tabAll").click();
    await page.locator("#allowInApp").check();
    await page.locator("#allowNews").check();
    await page.locator("#saveSettings").click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("smshahid-notification-preferences")||"null"));
    assert.equal(saved.in_app_enabled,true);
    assert.equal(saved.breaking_enabled,true);
    assert.equal(saved.push_enabled,false);
    assert.equal(errors.length,0);
    console.log("LIVE_ALERTS "+JSON.stringify({origin,width,http:r?.status(),metric,guestSettings:true,errors}));
    tests++;
   }finally{await page.close()}
  }
 }
 for(const path of ["/","/market-intelligence/","/economic-calendar/","/market-reaction/"]){
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:"block"});
  try{
   const r=await page.goto("https://www.smshahidshah.com"+path,{waitUntil:"domcontentloaded",timeout:23000});
   assert.equal(r?.status(),200);
   const m=await page.evaluate(()=>{
    const h=document.querySelector("body > header:not(.site-legacy-header)");
    const b=h.querySelector(".wrap.nav").getBoundingClientRect();
    return {links:h.querySelectorAll(".learning-nav a").length,left:Math.round(b.left),right:Math.round(innerWidth-b.right),w:Math.round(b.width)}
   });
   assert.equal(m.links,6);
   assert.equal(m.w,1120);
   assert.equal(m.left,m.right);
   if(path!=="/")assert((await page.locator('a[href="/notifications/"]').count())>0,
     "Smart Alerts linked from "+path);
   console.log("LIVE_HEADER "+JSON.stringify({path,status:r?.status(),...m}));
   tests++;
  }finally{await page.close()}
 }
 console.log("PASS live Notifications + homepage, Markets, Calendar and Reaction "+tests+" browser checks");
}finally{await browser.close()}
