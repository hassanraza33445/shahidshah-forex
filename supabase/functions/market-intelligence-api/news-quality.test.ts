import {classifyHeadline, deduplicateHeadlineFeed, isEvergreenListing, nearDuplicateHeadline} from "./news-quality.ts";
function check(ok: boolean, label: string){ if(!ok)throw new Error(label); }
const t0="2026-11-17T10:00:00Z";
const item=(title:string,category="Gold",publisher="Publisher A",ts=t0)=>({title,category,publisher,published_at:ts});
Deno.test("publisher suffix and rearranged wording collapse only for near-identical reports",()=>{
 const a=item("Gold prices climb as Dollar weakens ahead of Federal Reserve meeting - Publisher A");
 const b=item("Gold prices climb as Dollar weakens ahead of Federal Reserve meeting - Publisher B","Gold","Publisher B");
 check(nearDuplicateHeadline(a,b),"same reported headline should collapse");
 check(deduplicateHeadlineFeed([a,b]).length===1,"one story shown");
 const c=item("Gold prices climb as Dollar weakens ahead of the Federal Reserve meeting - Publisher C","Gold","Publisher C");
 check(nearDuplicateHeadline(a,c),"minor rewording across publishers should collapse");
 check(deduplicateHeadlineFeed([a,b,c]).length===1,"minor wording differences collapse together");
});
Deno.test("conflicting economic announcements are not merged",()=>{
 const a=item("US crude stocks rise as gasoline inventories fall in weekly report","Energy");
 const b=item("US crude stocks fall as gasoline inventories rise in weekly report","Energy");
 check(!nearDuplicateHeadline(a,b),"opposite release outcomes must remain");
});
Deno.test("different data and publication times stay separate",()=>{
 const a=item("US CPI increases 2.7 percent as energy prices move higher","Economic Data");
 const b=item("US CPI increases 2.8 percent as energy prices move higher","Economic Data");
 const old=item(a.title,"Economic Data","Publisher A","2026-11-16T02:00:00Z");
 check(!nearDuplicateHeadline(a,b),"numeric result changed");
 check(!nearDuplicateHeadline(a,old),"different release times");
});
Deno.test("speculative headline never auto HOT",()=>{
 check(classifyHeadline("Gold CPI preview: Fed could cut rates after inflation report","Gold").priority==="WARM","preview");
 check(classifyHeadline("US CPI rises above expectations in October","Economic Data").priority==="HOT","reported data");
 check(classifyHeadline("Federal Reserve cuts benchmark interest rate after FOMC decision","Central Banks").priority==="HOT","reported rate action");
 check(classifyHeadline("Geopolitical war risk outlook might affect markets","Geopolitics").priority!=="HOT","speculation");
});
Deno.test("routine evergreen pages are not breaking news",()=>{
 check(isEvergreenListing("Bitcoin BTC Live Price, News, Chart and Price History - Yahoo Finance"),"evergreen detected");
 check(!isEvergreenListing("Bitcoin price jumps after ETF decision"),"real story retained");
});
