(()=>{"use strict";
const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
const assets=[
 {symbol:"XAU/USD",label:"Gold",match:/\b(gold|xau|bullion)\b/i,category:"Gold"},
 {symbol:"EUR/USD",label:"Euro / US Dollar",match:/\b(eur\/?usd|euro|ecb)\b/i,category:"Forex"},
 {symbol:"GBP/USD",label:"British Pound",match:/\b(gbp\/?usd|pound|boe|sterling)\b/i,category:"Forex"},
 {symbol:"USD/JPY",label:"Dollar / Japanese Yen",match:/\b(usd\/?jpy|yen|boj)\b/i,category:"Forex"},
 {symbol:"BTC/USD",label:"Bitcoin",match:/\b(btc|bitcoin|crypto)\b/i,category:"Crypto"}
];
function storyMatches(item,category){
 const label=String(item?.category||"").toLowerCase();
 const text=(String(item?.title||"")+" "+String(item?.summary||"")).toLowerCase();
 if(category==="Gold")return label==="gold"||/\b(gold|bullion|xau\/?usd|xau)\b/i.test(text);
 if(category==="Forex")return label==="forex"||/\b(forex|currency|currencies|usd|eur|gbp|jpy|yen|dollar|sterling|euro|dxy)\b/i.test(text);
 if(category==="Crypto")return label==="crypto"||/\b(bitcoin|btc|crypto|ethereum|eth)\b/i.test(text);
 if(category==="Economic Data")return ["economic data","economy","central banks"].includes(label)||/\b(inflation|interest rates?|rate hike|rate cut|cpi|ppi|gdp|fed|fomc|jobs report|payroll|central bank|employment|opec)\b/i.test(text);
 return label===String(category).toLowerCase();
}
function showNews(items){
 const data=Array.isArray(items)?items:[],root=$("marketSnapshotItems"),watch=$("dashboardWatchlist");
 if(root){
  root.replaceChildren();
  if(!data.length)root.append(make("span","snapshot-item","Source-linked news temporarily unavailable"));
  else for(const [title,category] of [["Gold","Gold"],["Forex","Forex"],["Crypto","Crypto"],["Economy","Economic Data"]]){
   const count=data.filter(x=>storyMatches(x,category)).length;
   const item=make("span","snapshot-item");item.append(make("i","snapshot-dot"),make("strong","",title),make("small","",count+" headlines"));root.append(item);
  }
 }
 if(!watch)return;
 watch.replaceChildren();
 if(!data.length){watch.append(make("div","mini-empty","Source-linked monitoring is temporarily unavailable."));return}
 for(const asset of assets){
  const count=data.filter(x=>asset.match.test(String(x.title||"")+" "+String(x.summary||""))).length;
  const row=make("div","watchlist-row");
  const left=make("span","watchlist-left");left.append(make("strong","",asset.symbol),make("small","",asset.label));
  const right=make("span","watchlist-right");right.append(make("strong","",count+" articles"),make("small","","in current feed"));
  row.append(left,right);watch.append(row);
 }
}
function showEvents(items){
 const root=$("dashboardEventsList");if(!root)return;root.replaceChildren();
 const now=Date.now();
 const events=(Array.isArray(items)?items:[]).filter(e=>e&&e.scheduled_at&&Number.isFinite(new Date(e.scheduled_at).getTime())&&new Date(e.scheduled_at).getTime()>=now).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).slice(0,4);
 if(!events.length){root.append(make("div","mini-empty","No upcoming events with verified scheduled times."));return}
 const dateFormat=new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"Asia/Kuala_Lumpur"});
 const timeFormat=new Intl.DateTimeFormat("en-US",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Kuala_Lumpur"});
 for(const event of events){
  const scheduled=new Date(event.scheduled_at),row=make("div","dashboard-event");
  const when=make("time","event-time");
  when.dateTime=scheduled.toISOString();
  when.append(make("strong","event-day",dateFormat.format(scheduled)),make("small","event-hour",timeFormat.format(scheduled)+" MYT"));
  row.append(when);
  const body=make("span","event-copy");
  body.append(make("strong","",String(event.title||event.event_name||event.name||event.event||"Economic event").slice(0,105)));
  const region=[event.currency,event.country].filter(Boolean).join(" · ");
  if(region)body.append(make("small","",region.slice(0,60)));
  row.append(body);
  const impact=String(event.impact||event.importance||"").toLowerCase();
  const level=impact.includes("high")?"high":impact.includes("medium")?"medium":impact.includes("low")?"low":"";
  if(level)row.append(make("span","event-impact event-impact-"+level,level.toUpperCase()));
  root.append(row);
 }
}
window.addEventListener("sm:premium-news",event=>showNews(event.detail?.items));
window.addEventListener("sm:premium-events",event=>showEvents(event.detail?.items));
})();