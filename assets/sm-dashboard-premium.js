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
window.addEventListener("sm:premium-news",event=>showNews(event.detail?.items));

})();