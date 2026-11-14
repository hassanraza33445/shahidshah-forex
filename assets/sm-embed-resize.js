(()=>{"use strict";
if(window.parent===window||new URLSearchParams(location.search).get("embedded")!=="1")return;
document.documentElement.classList.add("sm-embed-surface");
let requested=false,lastHeight=0;
function contentNode(){
 const selectors=["#workspace:not(.hidden) .content","main",".layout:not(.hidden) .content",".page.active",".content","body"];
 for(const selector of selectors){const node=document.querySelector(selector);if(node&&getComputedStyle(node).display!=="none")return node}
 return document.body;
}
function report(){
 requested=false;
 const node=contentNode();
 if(!node)return;
 const rect=node.getBoundingClientRect();
 const top=Math.max(0,window.scrollY||0);
 const footerAllowance=node===document.body?18:40;
 let bottom=Math.ceil(rect.bottom+top+footerAllowance);
 if(node!==document.body){
  const last=node.lastElementChild;
  if(last){const edge=last.getBoundingClientRect().bottom+top+footerAllowance;bottom=Math.max(bottom,Math.ceil(edge))}
 }
 const height=Math.min(17900,Math.max(390,bottom));
 if(Math.abs(lastHeight-height)<3)return;
 lastHeight=height;
 try{window.parent.postMessage({type:"sm:embed-height",height},location.origin)}catch(_){}
}
function schedule(){if(requested)return;requested=true;requestAnimationFrame(report)}
function init(){
 const root=contentNode();
 if(window.ResizeObserver){
  const observer=new ResizeObserver(schedule);observer.observe(document.body);observer.observe(document.documentElement);
  if(root&&root!==document.body&&root!==document.documentElement)observer.observe(root);
 }
 if(window.MutationObserver)new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
 window.addEventListener("resize",schedule);
 window.addEventListener("load",schedule);
 document.addEventListener("sm:member-verified",schedule);
 document.addEventListener("transitionend",schedule);
 schedule();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
