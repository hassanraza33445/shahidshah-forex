import assert from "node:assert/strict";
import {chromium} from "playwright";
const BASE="https://qggtdwixwafcmorepkks.supabase.co";
const KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
let results=[];
async function check(label,url,opts={}){
 const start=Date.now(),r=await fetch(url,{...opts,signal:AbortSignal.timeout(14000)});
 const body=await r.text();
 const row={label,http:r.status,ms:Date.now()-start,type:r.headers.get("content-type"),bytes:body.length};
 results.push(row);console.log("ONESIGNAL_LIVE "+JSON.stringify(row));return {r,body};
}
const api=await check("push-config",BASE+"/functions/v1/market-notifications-api?mode=push-config",{headers:{apikey:KEY}});
assert.equal(api.r.status,200);
const config=JSON.parse(api.body);
assert.equal(config.configured,false);
assert.equal(config.app_id,null);
const post=await check("unauthorized-dispatch",BASE+"/functions/v1/market-push-dispatch",{
 method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:"{}"});
assert.equal(post.r.status,403);
for(const domain of ["https://www.smshahidshah.com","https://smshahidshah.com"]){
 const worker=await check("worker "+domain,domain+"/onesignal/OneSignalSDKWorker.js");
 assert.equal(worker.r.status,200,"OneSignal scoped worker path must be published");
 assert.match(worker.body,/OneSignalSDK\.sw\.js/);
 assert(!/text\/html/.test(worker.r.headers.get("content-type")||""),"Must be actual JS, not an HTML fallback");
}
const browser=await chromium.launch({headless:true});
try{
 for(const domain of ["https://www.smshahidshah.com","https://smshahidshah.com"]){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:"block"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message.slice(0,190)));
   try{
    const r=await page.goto(domain+"/notifications/?onesignal-qa=20261114",{waitUntil:"domcontentloaded",timeout:22000});
    assert.equal(r?.status(),200);
    await page.waitForFunction(()=>document.querySelector("#allCount")?.textContent!=="—",{},{timeout:16000});
    const v=await page.evaluate(()=>{
      const h=document.querySelector("#sm-site-header"),rect=h.querySelector(".wrap.nav").getBoundingClientRect();
      return {
        alertCount:document.querySelector("#allCount")?.textContent,
        configMessage:document.querySelector("#pushStatus")?.textContent,
        enableDisabled:document.querySelector("#enablePush")?.disabled,
        disableDisabled:document.querySelector("#disablePush")?.disabled,
        sdkLoaded:!!document.querySelector('script[src*="OneSignalSDK.page.js"]'),
        links:h.querySelectorAll(".learning-nav a").length,
        social:h.querySelectorAll(".social-link svg").length,
        margins:[Math.round(rect.left),Math.round(innerWidth-rect.right)],
        width:Math.round(rect.width)
      };
    });
    assert(Number(v.alertCount)>0);
    assert.equal(v.enableDisabled,true,"Do not allow push before OneSignal credentials");
    assert.equal(v.disableDisabled,true,"No account to manage");
    assert.equal(v.sdkLoaded,false,"OneSignal SDK must not load without explicit user click");
    assert.match(v.configMessage,/No push permission requested|setup unavailable/i);
    assert.equal(v.links,6);assert.equal(v.social,4);
    assert.equal(v.margins[0],v.margins[1],"Centered exact homepage header");
    if(width===1440)assert.equal(v.width,1120);
    assert.equal(errors.length,0,"No browser JavaScript errors");
    console.log("ONESIGNAL_BROWSER "+JSON.stringify({domain,width,metrics:v,errors}));
   }finally{await page.close()}
  }
 }
}finally{await browser.close()}
console.log("PASS OneSignal production staged UI and browser security: "+results.length+" network checks");
