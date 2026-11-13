import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const urls=["https://www.smshahidshah.com","https://smshahidshah.com"];
let checks=0;
try{
 for(const origin of urls){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:860},serviceWorkers:"block"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   try{
    const home=await page.goto(origin+"/?qa=member20261114",{waitUntil:"domcontentloaded",timeout:25000});
    assert.equal(home?.status(),200);
    const head=page.locator("body > header:not(.site-legacy-header) .wrap.nav").first();
    await head.waitFor({timeout:10000});
    const h=await head.boundingBox();
    assert(h?.width>0);
    if(width===1440){assert.equal(Math.round(h.width),1120);assert(Math.abs(h.x-(1440-h.width-h.x))<=2)}
    const nav=await page.locator(".learning-nav a").count();
    assert.equal(nav,6);
    const auth=await page.goto(origin+"/auth/?next=%2Fapp%2F%3Ftab%3Dstudio",{waitUntil:"domcontentloaded",timeout:25000});
    assert.equal(auth?.status(),200);
    await page.locator("#authForm").waitFor({timeout:10000});
    assert.equal(await page.locator("#signUpTab").isVisible(),true);
    assert.equal(await page.locator("#googleBtn").isVisible(),true);
    const dimensions=await page.locator(".auth-panel").boundingBox();
    assert(dimensions.width>0&&dimensions.width<=width+2);
    if(width===390)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=392),true);
    console.log("LIVE_MEMBER_AUTH "+JSON.stringify({origin,width,home:home.status(),auth:auth.status(),headerWidth:Math.round(h.width),loginForm:true,overflow:false,errors:errors.slice(0,2)}));
    checks++;
   }finally{await page.close()}
  }
  const p=await browser.newPage({viewport:{width:390,height:860},serviceWorkers:"block"});
  try{
   const a=await p.goto(origin+"/app/?tab=studio",{waitUntil:"domcontentloaded",timeout:25000});
   assert.equal(a?.status(),200);
   await p.waitForURL(/\/auth\/\?next=/,{timeout:14000});
   const next=new URL(p.url()).searchParams.get("next");
   assert.equal(next,"/app/?tab=studio");
   console.log("LIVE_MEMBER_GUEST "+JSON.stringify({origin,next,redirected:true}));
   checks++;
  }finally{await p.close()}
  const market=await browser.newPage({viewport:{width:390,height:860},serviceWorkers:"block"});
  try{
   const a=await market.goto(origin+"/market-intelligence/",{waitUntil:"domcontentloaded",timeout:25000});
   assert.equal(a?.status(),200);
   await market.waitForURL(/\/auth\/\?next=/,{timeout:14000});
   assert.equal(new URL(market.url()).searchParams.get("next"),"/market-intelligence/");
   console.log("LIVE_MEMBER_PROTECTED "+JSON.stringify({origin,route:"/market-intelligence/",redirect:true}));
   checks++;
  }finally{await market.close()}
 }
 console.log("PASS production premium member app, auth and guest protection: "+checks+" checks");
}finally{await browser.close()}
