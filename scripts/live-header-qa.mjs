import {chromium} from "playwright";
const routes=["/","/market-intelligence/","/content-studio/","/ai-video-scripts/"];
const browser=await chromium.launch({headless:true});
try{
 for(const origin of ["https://smshahidshah.com","https://www.smshahidshah.com"]){
  for(const path of routes){
   for(const width of [1666,390]){
    const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:"block"});
    const requests=[],errors=[];
    page.on("pageerror",e=>errors.push(e.message.slice(0,170)));
    page.on("response",r=>{if(r.url().includes("/assets/site-master-header."))requests.push({path:new URL(r.url()).pathname,status:r.status(),type:r.headers()["content-type"]})});
    try{
      const query="?header-check=20261114-"+Date.now();
      const res=await page.goto(origin+path+query,{waitUntil:"domcontentloaded",timeout:22000});
      await page.waitForTimeout(650);
      const result=await page.evaluate(()=>{
        const h=document.querySelector("body > header:not(.site-legacy-header)"),
              row=h?.querySelector(".wrap.nav"),
              brand=h?.querySelector(".brand-avatar"),
              nav=h?.querySelector(".learning-nav");
        const rect=row?.getBoundingClientRect(), w=innerWidth;
        const old=[...document.querySelectorAll(".site-legacy-header")];
        return {
          finalURL:location.href,viewport:w,
          header:!!h,brand:!!brand,brandImage:brand?.querySelector("img")?.naturalWidth||0,
          headerWidth:h?Math.round(h.getBoundingClientRect().width):null,
          rowLeft:rect?Math.round(rect.left):null,rowWidth:rect?Math.round(rect.width):null,
          rowRight:rect?Math.round(w-rect.right):null,
          centered:rect?Math.abs(rect.left-(w-rect.right))<=2:null,
          navLinks:nav?[...nav.querySelectorAll("a")].map(a=>a.textContent.trim()):[],
          svgSocial:h?.querySelectorAll(".social-link svg").length||0,
          oldHeadersVisible:old.filter(x=>getComputedStyle(x).display!=="none").length,
          cssShared:!!document.querySelector('link[href*="site-master-header.css"]'),
          jsShared:!!document.querySelector('script[src*="site-master-header.js"]'),
          theme:document.documentElement.dataset.theme
        }
      });
      console.log("LIVE_HEADER "+JSON.stringify({origin,path,width,http:res?.status(),...result,assets:requests,errors}));
    }catch(e){console.log("LIVE_HEADER_ERROR "+JSON.stringify({origin,path,width,error:String(e).slice(0,320)}))}
    finally{await page.close()}
   }
  }
 }
}finally{await browser.close()}
