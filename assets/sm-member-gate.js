(()=>{"use strict";
const root=document.documentElement;root.classList.add("sm-member-checking");
const base="https://qggtdwixwafcmorepkks.supabase.co",key="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
function signin(){const path=location.pathname+location.search+location.hash;location.replace("/auth/?next="+encodeURIComponent(path))}
function addNavigation(){
 if(document.querySelector(".sm-private-dock"))return;
 const nav=document.createElement("nav");nav.className="sm-private-dock";nav.setAttribute("aria-label","Member mobile navigation");
 const links=[["⌂","Home","/app/"],["▥","AI Studio","/app/?tab=studio"],["◈","AI Tools","/app/?tab=tools"],["♢","Mentorship","/app/?tab=mentorship"],["♙","Profile","/app/?tab=profile"]];
 for(const [icon,label,url] of links){const a=document.createElement("a");a.href=url;const mark=document.createElement("span");mark.setAttribute("aria-hidden","true");mark.textContent=icon;a.append(mark,document.createTextNode(label));nav.append(a)}
 document.body.append(nav);
 if(!location.pathname.startsWith("/content-studio")){
  const back=document.createElement("a");back.href="/app/";back.className="sm-back-to-app";back.textContent="← Member Dashboard";document.body.append(back);
 }
}
async function validate(){
 try{
  // The library must be loaded before testing identity. A missing network dependency fails closed.
  if(!window.supabase?.createClient){signin();return}
  const client=window.supabase.createClient(base,key);
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user){signin();return}
  root.classList.remove("sm-member-checking");root.classList.add("sm-member-allowed");
  addNavigation();
 }catch(e){signin()}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",validate,{once:true});else validate();
})();