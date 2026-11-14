import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {chromium} from "playwright";
const root=process.cwd(),ORIGIN="http://127.0.0.1:8793";
const mime={".js":"application/javascript",".css":"text/css",".svg":"image/svg+xml",".html":"text/html"};
const fixture=`<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--surface:#fff;--surface2:#fff7e9;--line:#e3d7c6;--ink:#2b241c;--muted:#766957;--gold:#ba7a1b}html[data-theme=dark]{--surface:#241c17;--surface2:#2d2118;--line:#6d533b;--ink:#faf0dd;--muted:#c5b6a3;--gold:#f2b75d}</style><link rel="stylesheet" href="/assets/sm-news-reader.css"></head><body><button id="openArticle">Read News Details</button><button id="emptySummary">Open Headline Only</button><script src="/assets/sm-news-reader.js"></script><script>const first={id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",title:"Gold market report title from source",summary:"A source-linked factual RSS excerpt on international gold market conditions.",publisher:"Example Finance",published_at:"2026-11-14T07:00:00Z",category:"Gold",priority:"HOT",verification_status:"unverified"};document.getElementById("openArticle").addEventListener("click",e=>window.SMNewsReader.open(first,{trigger:e.currentTarget}));document.getElementById("emptySummary").addEventListener("click",e=>window.SMNewsReader.open({...first,summary:""},{trigger:e.currentTarget}));</script></body></html>`;
const server=createServer(async(req,res)=>{
 const pathname=(req.url||"/").split("?")[0];
 if(pathname==="/__fixture"){res.writeHead(200,{"Content-Type":"text/html"});res.end(fixture);return}
 let file=resolve(root,"."+decodeURIComponent(pathname));
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
 try{const bytes=await readFile(file);res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});res.end(bytes)}
 catch{res.writeHead(404);res.end("Not found")}
});
await new Promise(resolve=>server.listen(8793,"127.0.0.1",resolve));
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const [width,theme] of [[1440,"light"],[390,"dark"]]){
  const page=await browser.newPage({viewport:{width,height:830}});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(ORIGIN+"/__fixture",{waitUntil:"load"});
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await page.locator("#openArticle").click();
  await page.locator("dialog#smNewsReader[open]").waitFor({timeout:4000});
  assert.equal(await page.locator("#smNewsReaderTitle").innerText(),"Gold market report title from source");
  assert.match(await page.locator(".sm-news-reader-excerpt").innerText(),/source-linked factual RSS excerpt/);
  assert.match(await page.locator(".sm-news-reader-meta").innerText(),/Example Finance/);
  assert.match(await page.locator(".sm-news-reader-meta").innerText(),/MYT/);
  assert.match(await page.locator(".sm-news-reader-attribution").innerText(),/not the publisher.s full article/i);
  assert.equal(await page.locator("dialog a[href^='https://']").count(),0,"No external Google or publisher links in reader");
  assert.equal(new URL(page.url()).pathname,"/__fixture","Reader does not navigate away");
  const script=await page.locator(".sm-news-reader-script").getAttribute("href");
  assert.equal(script,"/app/?tab=studio&studio=create&news=cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  const visibility=await page.locator(".sm-news-reader-title").evaluate(el=>getComputedStyle(el).color);
  assert.notEqual(visibility,"rgba(0, 0, 0, 0)","Reader text remains visible in both themes");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(),0,"Escape closes native dialog");
  assert.equal(await page.locator("#openArticle").evaluate(el=>document.activeElement===el),true,"Focus returns to opener");
  await page.locator("#emptySummary").click();
  assert.equal(await page.locator(".sm-news-reader-noexcerpt").isVisible(),true,"Missing full article text must be disclosed");
  assert.equal(await page.locator(".sm-news-reader-excerpt").count(),0,"No fabricated article content");
  await page.locator(".sm-news-reader-close").click();
  assert.equal(await page.locator("dialog[open]").count(),0);
  assert.deepEqual(errors,[],"No browser JavaScript errors");
  console.log("PASS in-site reader at "+width+"px in "+theme+" theme: real summary, local navigation, accessible modal");
  await page.close();
 }
 const files=await Promise.all(["app/index.html","market-intelligence/index.html","assets/sm-member-app.js"].map(async path=>(await readFile(resolve(root,path),"utf8"))));
 assert(files[0].includes("sm-news-reader.js"),"Member dashboard loads on-site reader");
 assert(files[1].includes("sm-news-reader.js"),"Market Intelligence loads on-site reader");
 assert(files[2].includes('window.SMNewsReader?.open(item'),"Member news cards open on-site reader");
 assert(!files[2].includes("Open via Google News"),"Member cards do not link to Google News");
 assert(!files[1].includes('link("Read original'),"Market Intelligence cards do not link externally");
 console.log("PASS member and market news routes use same in-site reader, not Google News");
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
