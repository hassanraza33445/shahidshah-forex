import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const ROOT="https://www.smshahidshah.com";
const paths=["/","/market-intelligence/","/economic-calendar/","/market-reaction/"];
let checks=0;
try{
 for(const path of paths){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:"block"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message.slice(0,180)));
   try{
    const res=await page.goto(ROOT+path+"?qa=marketreaction20261114",{waitUntil:"domcontentloaded",timeout:24000});
    assert.equal(res?.status(),200,"Published page HTTP 200 "+path);
    const h=page.locator("body > header:not(.site-legacy-header)").first();
    await h.waitFor({timeout:9000});
    if(path==="/market-reaction/"){
     await page.waitForFunction(()=>{
      const el=document.querySelector("#eventCount");return el&&el.textContent!=="—";
     },{},{timeout:15000});
     const eventCount=Number(await page.locator("#eventCount").innerText());
     assert(Number.isFinite(eventCount),"valid event count");
     assert((await page.locator("#results article.event").count())>0,"Economic history shown");
     const provider=await page.locator("#providerStatus").innerText();
     if(/setup pending/i.test(provider)){
      assert.equal(await page.locator("#results .obs").count(),0,"No fabricated prices without provider");
      assert((await page.locator("#results .nodata").count())>0,"Missing data visibly explained");
     }
    }
    if(path==="/market-intelligence/"||path==="/economic-calendar/"){
      assert((await page.locator('a[href="/market-reaction/"]').count())>0,
       "Market Reaction link visible on upstream page "+path);
    }
    const metrics=await h.evaluate(el=>{
      const row=el.querySelector(".wrap.nav").getBoundingClientRect();
      return {menu:[...el.querySelectorAll(".learning-nav a")].map(a=>a.textContent.trim()),
       width:Math.round(row.width),left:Math.round(row.left),right:Math.round(innerWidth-row.right),
       avatar:el.querySelector(".brand-avatar img")?.naturalWidth||0,
       socialIcons:el.querySelectorAll(".social-link svg").length};
    });
    assert.equal(metrics.menu.length,6);
    assert.equal(metrics.socialIcons,4);
    assert(metrics.avatar>0,"Brand portrait loads");
    assert(Math.abs(metrics.left-metrics.right)<=2,"Centered header left/right must match");
    if(width===1440)assert.equal(metrics.width,1120,"Exactly homepage 1120px desktop");
    assert.equal(errors.length,0,"No JavaScript page errors");
    console.log("LIVE_REACTION_UI "+JSON.stringify({path,width,http:res?.status(),header:metrics,errors}));
    checks++;
   }finally{await page.close()}
  }
 }
 console.log("PASS Market Reaction published desktop/mobile + original homepage header QA "+checks+" routes");
}finally{await browser.close()}
