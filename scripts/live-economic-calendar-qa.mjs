import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
let failed=0;
try{
 for(const domain of ["https://smshahidshah.com","https://www.smshahidshah.com"]){
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:"block"});
   const errors=[];page.on("pageerror",e=>errors.push(e.message.slice(0,160)));
   try{
    const r=await page.goto(domain+"/economic-calendar/?qa=20261114",{waitUntil:"domcontentloaded",timeout:22000});
    await page.waitForFunction(()=>{
     const x=document.querySelector("#total");return x&&x.textContent!=="—"&&x.textContent!=="";
    },{},{timeout:16000});
    const metric=await page.evaluate(()=>{
     const h=document.querySelector("#sm-site-header");
     const row=h?.querySelector(".wrap.nav")?.getBoundingClientRect();
     return {url:location.href,events:document.querySelectorAll("#events tr").length,total:document.getElementById("total")?.textContent,
      headerLinks:h?.querySelectorAll(".learning-nav a").length,headerWidth:row?.width,headerLeft:row?.left,
      headerRight:row?innerWidth-row.right:null,sourceLinks:document.querySelectorAll("#events .event-source[href^='https://']").length,
      figures:[...document.querySelectorAll("#events td.missing")].length,
      theme:document.documentElement.dataset.theme
     };
    });
    const pass=r?.status()===200&&metric.events>0&&metric.sourceLinks>0&&metric.headerLinks===6&&
      (width<600||Math.abs(metric.headerLeft-metric.headerRight)<3)&&!errors.length;
    console.log("LIVE_ECONOMIC "+JSON.stringify({domain,width,http:r?.status(),pass,metric,errors}));
    if(!pass)failed++;
   }catch(e){failed++;console.log("LIVE_ECONOMIC_ERROR "+JSON.stringify({domain,width,error:String(e).slice(0,300)}))}
   finally{await page.close()}
  }
 }
}finally{await browser.close()}
if(failed)process.exit(1);
console.log("PASS published economic calendar visual & header QA on both domains");
