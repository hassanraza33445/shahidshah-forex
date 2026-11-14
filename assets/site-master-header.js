/* Homepage-identical header for all public routes, retaining page-specific app controls. */
(()=>{"use strict";
 const HEADER_TEMPLATE="<header id=\"sm-site-header\" role=\"banner\"><div class=\"wrap nav\"><a class=\"brand\" href=\"/\"><span class=\"brand-avatar\"><img src=\"/shahid-shah-profile.jpg\" alt=\"S M Shahid Shah\"></span><span><b>S M Shahid Shah</b><small>SALE &amp; BUSINESS CONSULTANT</small></span></a><nav class=\"learning-nav\" aria-label=\"Main navigation\"><a href=\"/\">Home</a><a href=\"/market-intelligence/\">Market Intelligence</a><a href=\"/content-studio/\">AI Studio</a><a href=\"/ai-tools/\">AI Scripts</a><a href=\"/videos/\">Videos</a><a href=\"/about/\">About</a></nav><div class=\"nav-actions\"><nav class=\"social-dock\" aria-label=\"Social media\"><a class=\"social-link\" data-brand=\"youtube\" id=\"ytTop\" target=\"_blank\" aria-label=\"YouTube\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M23 7s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C17.4 4 13.2 4 12 4s-5.4 0-8.2.1c-.4.1-1.2.1-2 .9C1.2 5.6 1 7 1 7S.8 8.6.8 10.2v1.5C.8 13.4 1 15 1 15s.2 1.4.8 2c.8.8 1.8.8 2.3.9 1.7.2 7.2.2 7.9.2 1.2 0 5.4 0 8.2-.1.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C23.2 8.6 23 7 23 7ZM9.6 14.6V8.9l5.7 2.9-5.7 2.8Z\"/></svg></a><a class=\"social-link\" data-brand=\"whatsapp\" id=\"waTop\" target=\"_blank\" aria-label=\"WhatsApp\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.5 0 .2 5.3.2 11.8c0 2.1.5 4.1 1.6 5.9L.1 24l6.5-1.7a12 12 0 0 0 5.5 1.4c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.1-3.4-8.4Zm-8.4 18.2c-1.7 0-3.4-.5-4.8-1.3l-.3-.2-3.9 1 1-3.8-.2-.4a9.8 9.8 0 1 1 8.2 4.7Zm5.4-7.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-2-.9-3.3-1.7-4.6-3.9-.3-.5.3-.5.9-1.7.1-.2 0-.4-.1-.6l-.9-2.2c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.2 2.2 1 3.1 1 4.2.8.7-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3Z\"/></svg></a><a class=\"social-link\" data-brand=\"facebook\" id=\"fbTop\" target=\"_blank\" aria-label=\"Facebook\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.3c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12Z\"/></svg></a><a class=\"social-link\" data-brand=\"instagram\" id=\"igTop\" target=\"_blank\" aria-label=\"Instagram\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"17.5\" cy=\"6.5\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/></svg></a></nav><button class=\"theme-toggle\" id=\"themeToggle\" type=\"button\" aria-label=\"Switch theme\"><svg id=\"themeIcon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z\"/></svg></button></div></div></header>";
 const existing=document.getElementById("sm-site-header");
 const home=!!existing;
 if(!existing)document.body.insertAdjacentHTML("afterbegin",HEADER_TEMPLATE);
 const header=document.getElementById("sm-site-header");
 if(!header)return;
 // Keep Login and Sign Up visible on every public route, without replacing the approved header.
 const actions=header.querySelector(".nav-actions");
 if(actions&&!actions.querySelector(".account-links")){
  const wrapper=document.createElement("div");wrapper.className="account-links";
  for(const [label,url,kind] of [["Login","/auth/?next=%2Fapp%2F","account-login"],["Sign Up","/auth/?mode=signup&next=%2Fapp%2F","account-signup"]]){
   const link=document.createElement("a");link.href=url;link.className=kind;link.textContent=label;wrapper.append(link);
  }
  actions.insertBefore(wrapper,header.querySelector("#themeToggle"));
 }
 const themeButton=header.querySelector("#themeToggle"),icon=header.querySelector("#themeIcon");
 const links={ytTop:"https://www.youtube.com/@SMShahidShah",waTop:"https://wa.me/601158646564",fbTop:"https://www.facebook.com/SMShahidShah87",igTop:"https://www.instagram.com/s_m_shahid_shah/"};
 function validLink(value){try{let u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null}catch{return null}}
 function setLinks(config={}){
  const names={ytTop:"youtube_channel",waTop:"whatsapp_channel",fbTop:"facebook_link",igTop:"instagram_link"};
  for(const [id,fallback] of Object.entries(links)){
   const el=header.querySelector("#"+id);if(!el)continue;
   const href=validLink(config[names[id]])||fallback;
   el.href=href;el.rel="noopener noreferrer";el.target="_blank";
  }
 }
 // Homepage already loads its own dynamic social settings and handles theme events.
 if(!home){
  setLinks();
  // Use the SAME published link configuration as the homepage when available.
  fetch("https://qggtdwixwafcmorepkks.supabase.co/rest/v1/rpc/get_webinar_public_config",{
   method:"POST",headers:{"apikey":"sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb","Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(6500)
  }).then(r=>r.ok?r.json():null).then(data=>{if(data&&typeof data==="object")setLinks(data)}).catch(()=>{});
  const moon='<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/>';
  const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>';
  function paintIcon(){const dark=document.documentElement.dataset.theme==="dark";icon.innerHTML=dark?sun:moon;themeButton.setAttribute("aria-label",dark?"Switch to light theme":"Switch to dark theme")}
  themeButton.addEventListener("click",()=>{
   const prev=document.documentElement.dataset.theme==="dark"?"dark":"light";
   const oldToggle=document.querySelector("#themeBtn")||document.querySelector("#theme");
   if(oldToggle&&oldToggle!==themeButton)oldToggle.click();
   if(document.documentElement.dataset.theme===prev){
    const next=prev==="dark"?"light":"dark";document.documentElement.dataset.theme=next;
    try{localStorage.setItem("smshahid-site-theme",next);localStorage.setItem("site-theme",next);localStorage.setItem("hub-theme",next);window.name="smshahid-theme:"+next}catch(_){}
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=next==="dark"?"#0A0E1A":"#F5EFE3";
   }
   paintIcon();
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)paintIcon()});
  addEventListener("storage",e=>{if(["smshahid-site-theme","site-theme"].includes(e.key)&&e.newValue){document.documentElement.dataset.theme=e.newValue==="dark"?"dark":"light";paintIcon()}});
  paintIcon();
 }
 // Keep sticky AI Tools tabs and Studio panels aligned to the actual header height.
 const syncHeight=()=>document.documentElement.style.setProperty("--sm-header-height",Math.ceil(header.getBoundingClientRect().height)+"px");
 syncHeight();
 if("ResizeObserver" in window)new ResizeObserver(syncHeight).observe(header);
 else addEventListener("resize",syncHeight);
 const path=location.pathname.replace(/\/index\.html$/,"/").replace(/\/+$/,"/")||"/";
 const active=path==="/learning-hub.html/"||path.startsWith("/ai-")||path==="/downloads/"?"/app/?tab=studio&amp;studio=create":path;
 header.querySelectorAll(".learning-nav a").forEach(a=>{if(a.getAttribute("href")===active){a.setAttribute("aria-current","page")}else a.removeAttribute("aria-current")});
})();
