/* A single in-site news reader shared by the member dashboard and Market Intelligence.
   RSS feeds provide headlines and excerpts, not full publisher articles. */
(()=>{"use strict";
let dialog,lastTrigger;
const $=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=String(txt);return el};
const clean=v=>String(v??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,1400);
function formatDate(value){
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("en-MY",{weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Karachi"}).format(d)+" PKT":"Published date unavailable";
}
function init(){
 if(dialog)return dialog;
 dialog=$("dialog","sm-news-reader");
 dialog.id="smNewsReader";
 dialog.setAttribute("aria-labelledby","smNewsReaderTitle");
 dialog.setAttribute("aria-describedby","smNewsReaderIntro");
 dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
 dialog.addEventListener("close",()=>{document.body.classList.remove("sm-news-reader-open");lastTrigger?.focus?.()});
 const shell=$("article","sm-news-reader-shell");
 const top=$("header","sm-news-reader-top");
 const brand=$("div","sm-news-reader-brand");
 const mark=$("span","sm-news-reader-mark","S M");
 const identity=$("span","sm-news-reader-identity");
 identity.append($("strong","","S M SHAHID SHAH"),$("small","","MARKET INTELLIGENCE"));
 brand.append(mark,identity);
 const close=$("button","sm-news-reader-close","×");close.type="button";close.setAttribute("aria-label","Close article details");close.addEventListener("click",()=>dialog.close());
 top.append(brand,close);
 const scroll=$("div","sm-news-reader-scroll");
 scroll.id="smNewsReaderContent";
 shell.append(top,scroll);
 dialog.append(shell);
 document.body.append(dialog);
 return dialog;
}
function open(item,opts={}){
 if(!item||typeof item!=="object")return;
 init();
 lastTrigger=opts.trigger||document.activeElement;
 const root=document.getElementById("smNewsReaderContent");
 root.replaceChildren();
 const eyebrow=$("div","sm-news-reader-eyebrow");
 eyebrow.append($("span","sm-news-reader-category",clean(item.category||"Global Markets")));
 if(item.priority==="HOT")eyebrow.append($("span","sm-news-reader-priority","HIGH EDITORIAL INTEREST"));
 const title=$("h2","sm-news-reader-title",clean(item.title||"Market update"));
 title.id="smNewsReaderTitle";
 const meta=$("div","sm-news-reader-meta");
 const publisher=clean(item.publisher||"Publisher not specified");
 meta.append($("span","","Publisher: "+publisher),$("span","",formatDate(item.published_at||item.first_seen_at)));
 const intro=$("p","sm-news-reader-intro","An on-site, source-attributed market news briefing.");
 intro.id="smNewsReaderIntro";
 const section=$("section","sm-news-reader-body");
 section.append($("h3","","Available News Summary"));
 const summary=clean(item.summary);
 if(summary){
  section.append($("p","sm-news-reader-excerpt",summary));
 }else{
  section.append($("p","sm-news-reader-noexcerpt","Only this headline was provided in the news feed. A detailed article summary is not currently available."));
 }
 const attribution=$("section","sm-news-reader-attribution");
 attribution.append($("h3","","Source & Transparency"));
 attribution.append($("p","","Source: "+publisher+". This briefing is based on source-linked headline information supplied to the platform. It is not the publisher's full article, and its details have not been independently verified."));
 const state=String(item.verification_status||"").toLowerCase();
 if(state&&state!=="verified")attribution.append($("span","sm-news-reader-disclaimer","Source verification: "+clean(state)));
 const actions=$("div","sm-news-reader-actions");
 const back=$("button","sm-news-reader-back","Close Details");back.type="button";back.addEventListener("click",()=>dialog.close());
 actions.append(back);
 if(item.id&&opts.allowScript!==false){
  const script=$("a","sm-news-reader-script","Create AI Script →");
  script.href="/app/?tab=studio&studio=create&news="+encodeURIComponent(String(item.id));
  actions.append(script);
 }
 root.append(eyebrow,title,meta,intro,section,attribution,actions);
 if(!dialog.open){dialog.showModal();document.body.classList.add("sm-news-reader-open")}
 closeOnFocus();
}
function closeOnFocus(){
 const b=dialog?.querySelector(".sm-news-reader-close");
 if(b)b.focus({preventScroll:true});
}
window.SMNewsReader={open,close:()=>dialog?.open&&dialog.close()};
})();
