import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
try {
 for(const [route,theme] of [["/ai-video-scripts/","light"],["/ai-banner-scripts/","dark"],["/learning-hub.html#video","light"]]) {
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  await ctx.addInitScript(t=>localStorage.setItem("smshahid-site-theme",t),theme);
  const page=await ctx.newPage();
  const errors=[], imgs=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("response",r=>{if(r.url().includes("/assets/banners/"))imgs.push({url:r.url(),status:r.status(),type:r.headers()["content-type"]})});
  await page.goto("https://www.smshahidshah.com"+route,{waitUntil:"domcontentloaded",timeout:25000});
  await page.waitForTimeout(2500);
  let data=await page.evaluate(()=>{
    const img=document.querySelector("#banner");
    const source=document.querySelector("#bannerDark");
    return {url:location.href,base:document.baseURI,rendered:!!img,src:img?.src,currentSrc:img?.currentSrc,naturalWidth:img?.naturalWidth,complete:img?.complete,sourceSrcSet:source?.srcset,visibility:img?getComputedStyle(img).visibility:null}
  });
  console.log("LIVE_PAGE "+JSON.stringify({route,theme,...data,errors,networkImages:imgs}));
  if(await page.locator(".tab[data-id='banner']").count()){
   await page.locator(".tab[data-id='banner']").click();
   await page.waitForTimeout(1000);
   data=await page.locator("#banner").evaluate(img=>({src:img.src,currentSrc:img.currentSrc,naturalWidth:img.naturalWidth,complete:img.complete}));
   console.log("AFTER_TAB "+JSON.stringify({route,theme,...data,networkImages:imgs}));
  }
  await ctx.close();
 }
} finally{await browser.close()}
