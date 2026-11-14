(()=>{"use strict";
const root=document.documentElement,embedded=new URLSearchParams(location.search).get("embedded")==="1";
root.classList.add("sm-member-checking");if(embedded)root.classList.add("sm-embedded");
const base="https://qggtdwixwafcmorepkks.supabase.co",key="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
function signin(){const path=location.pathname+location.search+location.hash;location.replace("/auth/?next="+encodeURIComponent(embedded?"/app/":path))}
function fail(message){
 root.classList.remove("sm-member-checking");root.classList.add("sm-member-failed");
 const body=document.body;let panel=document.getElementById("smMemberFailure");
 if(!panel){panel=document.createElement("div");panel.id="smMemberFailure";body.append(panel)}
 panel.replaceChildren();
 const logo=document.createElement("img");logo.src="/shahid-shah-profile.jpg";logo.alt="S M Shahid Shah";panel.append(logo);
 const title=document.createElement("strong");title.textContent="Unable to verify your session";panel.append(title);
 const help=document.createElement("p");help.textContent=message;panel.append(help);
 const retry=document.createElement("a");retry.href=location.href;retry.textContent="Try Again";panel.append(retry);
 const login=document.createElement("a");login.href="/auth/?next="+encodeURIComponent("/app/");login.textContent="Login / Sign Up";panel.append(login);
}
function addNavigation(){
 if(embedded||document.querySelector(".sm-private-dock"))return;
 const nav=document.createElement("nav");nav.className="sm-private-dock";nav.setAttribute("aria-label","Member mobile navigation");
 const links=[["⌂","Home","/app/"],["▥","AI Studio","/app/?tab=studio"],["◈","AI Tools","/app/?tab=tools"],["♢","Mentorship","/app/?tab=mentorship"],["♙","Profile","/app/?tab=profile"]];
 for(const [icon,label,url] of links){const a=document.createElement("a");a.href=url;const mark=document.createElement("span");mark.setAttribute("aria-hidden","true");mark.textContent=icon;a.append(mark,document.createTextNode(label));nav.append(a)}
 document.body.append(nav);
 if(!location.pathname.startsWith("/content-studio")){
  const back=document.createElement("a");back.href="/app/";back.className="sm-back-to-app";back.textContent="← Member Dashboard";document.body.append(back);
 }
}
function addEmbeddedRouting(){
 if(!embedded||window.parent===window)return;
 document.addEventListener("click",event=>{
  const target=event.target;if(!(target instanceof Element))return;
  const a=target.closest("a[href]");if(!a||a.target==="_blank"||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  let url;try{url=new URL(a.href,location.origin)}catch{return}
  if(url.origin!==location.origin)return;
  const path=url.pathname;
  let view="",page="";
  if(path==="/"){view="home"}
  else if(path.startsWith("/market-intelligence")){view="markets";page="hub"}
  else if(path.startsWith("/economic-calendar")){view="markets";page="calendar"}
  else if(path.startsWith("/market-reaction")){view="markets";page="reaction"}
  else if(path.startsWith("/notifications")){view="notifications"}
  else if(path.startsWith("/content-studio")){view="studio"}
  else if(path.startsWith("/ai-")||path.startsWith("/learning-hub")){view="tools"}
  if(view){event.preventDefault();window.parent.postMessage({type:"sm:open-module",view,page},location.origin)}
 },true);
}
function timed(promise,ms){return new Promise((resolve,reject)=>{
 const t=setTimeout(()=>reject(Error("Session verification timed out. Check your connection.")),ms);
 Promise.resolve(promise).then(x=>{clearTimeout(t);resolve(x)},e=>{clearTimeout(t);reject(e)});
})}
async function validate(){
 try{
  if(!window.supabase?.createClient)throw Error("Secure login service could not load.");
  const client=window.supabase.createClient(base,key);
  const {data,error}=await timed(client.auth.getUser(),10500);
  if(error||!data?.user){signin();return}
  root.classList.remove("sm-member-checking");root.classList.add("sm-member-allowed");
  addNavigation();addEmbeddedRouting();
  document.dispatchEvent(new CustomEvent("sm:member-verified"));
 }catch(e){fail(e?.message||"Please try again.")}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",validate,{once:true});else validate();
})();