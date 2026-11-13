import assert from "node:assert/strict";
import {chromium} from "playwright";
const ORIGIN="http://127.0.0.1:8765";
const sample={
 success:true,page:1,limit:24,last_refresh:"2026-11-13T15:35:00Z",
 items:[
 {id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",title:"Gold extends rally after monetary-policy update",summary:"An attributed sample headline used only for browser tests.",publisher:"Sample Publisher",original_url:"https://example.com/gold",published_at:"2026-11-13T15:30:00Z",category:"Gold",priority:"HOT",priority_reason:"Major macroeconomic development",verification_status:"unverified"},
 {id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",title:"Bitcoin volatility shifts ahead of policy comments",summary:"Sample content only.",publisher:"Test Market News",original_url:"https://example.org/btc",published_at:"2026-11-13T14:00:00Z",category:"Crypto",priority:"WARM",priority_reason:"Market coverage",verification_status:"unverified"}
]};
let failures=0;
const browser=await chromium.launch({headless:true});
try{
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
 for(const [route,pathPart] of [["/ai-banner-scripts/","/learning-hub.html#banner"],["/expo.html","/expo/"],["/webinar-admin/","/webinar-admin.html"]]){
  const page=await browser.newPage({serviceWorkers:"block"});
  await page.route("**/cdn.jsdelivr.net/**",r=>r.abort());
  await page.route("**/www.googletagmanager.com/**",r=>r.abort());
  await page.goto(ORIGIN+route,{waitUntil:"domcontentloaded",timeout:20000});
  await page.waitForURL(u=>u.href.includes(pathPart),{timeout:10000});
  assert.equal(page.url().includes(pathPart),true);
  await page.close();console.log("PASS legacy redirect "+route);
 }
}catch(e){failures++;console.error("Browser smoke FAILED:",e.stack||e)}
finally{await browser.close()}
if(failures)process.exit(1);
console.log("All browser smoke cases passed.");
