(()=>{"use strict";
const S="http://www.w3.org/2000/svg";
const P={
house:["M3 10 12 3l9 7","M5 9v12h14V9","M9 21v-8h6v8"],
newspaper:["M4 3h15a2 2 0 0 1 2 2v14a3 3 0 0 1-3 3H6a4 4 0 0 1-4-4V6","M7 7h9v5H7z","M7 15h9","M7 18h7","M2 18V6"],
chart:["M3 3v18h18","m6 16 5-5 4 3 5-8"],
sparkles:["m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"],
file:["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z","M14 2v6h6","M8 13h8","M8 17h8"],
wand:["M15 4l5 5","M4 20 16 8","m9 3 1 3","m3 9 3 1","m19 14 1 3","m13 20 3 1"],
graduation:["M2 10 12 5l10 5-10 5-10-5Z","M6 12v5c3 3 9 3 12 0v-5","M22 10v6"],
folder:["M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"],
bell:["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9","M10 21h4"],
user:["M20 21a8 8 0 0 0-16 0","M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
search:["m21 21-4.4-4.4","M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"],
moon:["M20.5 13.4A9 9 0 0 1 10.6 3.5 9 9 0 1 0 20.5 13.4Z"],
sun:["M12 2v2","M12 20v2","M4.93 4.93l1.42 1.42","M17.65 17.65l1.42 1.42","M2 12h2","M20 12h2","M4.93 19.07l1.42-1.42","M17.65 6.35l1.42-1.42","M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
menu:["M4 7h16","M4 12h16","M4 17h16"],
crown:["M2 7l5 4 5-7 5 7 5-4-2 13H4L2 7Z","M4 16h16"],
calendar:["M4 5h16a2 2 0 0 1 2 2v13H2V7a2 2 0 0 1 2-2Z","M7 3v5","M17 3v5","M2 11h20"],
flame:["M12 22c4 0 7-3 7-7 0-3-2-6-4-8 0 3-2 4-3 4 0-4-2-7-5-9 0 5-2 7-2 13 0 4 3 7 7 7Z"],
clock:["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z","M12 6v6l4 2"],
mic:["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z","M5 10a7 7 0 0 0 14 0","M12 17v5","M8 22h8"],
image:["M3 3h18v18H3V3Z","M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z","m3 18 6-6 4 4 3-3 5 5"],
play:["m8 5 11 7-11 7V5Z"],
settings:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z","M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1L14 3h-4l-.5 3a7 7 0 0 0-2 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1l.5 3h4l.5-3a7 7 0 0 0 2-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z"]
};
function svg(name){
 const icon=document.createElementNS(S,"svg");icon.setAttribute("viewBox","0 0 24 24");icon.setAttribute("class","ui-icon");icon.setAttribute("aria-hidden","true");icon.setAttribute("focusable","false");
 for(const d of P[name]||P.sparkles){const el=document.createElementNS(S,"path");el.setAttribute("d",d);icon.append(el)}
 return icon;
}
function fill(el,name){if(el)el.replaceChildren(svg(name))}
function iconButton(el,name){
 if(!el)return;
 for(const n of Array.from(el.childNodes)){if(n.nodeType===3)n.textContent=""}
 const old=el.querySelector(":scope > .ui-icon");if(old)old.remove();
 el.prepend(svg(name));
}
const names={home:"house",markets:"chart",studio:"sparkles",tools:"wand",mentorship:"graduation",profile:"user"};
function paintTheme(){
 iconButton(document.getElementById("memberThemeToggle"),document.documentElement.dataset.theme==="dark"?"sun":"moon");
 document.querySelectorAll("[data-preference-theme]").forEach(b=>{const active=b.dataset.preferenceTheme===document.documentElement.dataset.theme;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))});
}
function start(){
 document.querySelectorAll(".side-links button").forEach(b=>fill(b.querySelector(".nav-icon"),b.dataset.studioPage==="create"?"file":names[b.dataset.section]));
 document.querySelectorAll(".mobile-dock button").forEach(b=>fill(b.querySelector("span"),names[b.dataset.section]));
 iconButton(document.getElementById("openMenu"),"menu");
 iconButton(document.querySelector(".search-icon"),"search");
 iconButton(document.querySelector(".profile-icon"),"user");
 iconButton(document.querySelector(".notification-icon"),"bell");
 document.querySelectorAll(".dashboard-metrics .metric>span").forEach((el,i)=>fill(el,["newspaper","chart","clock"][i]));
 document.querySelectorAll(".quick-grid .tool-card>span").forEach((el,i)=>fill(el,["chart","sparkles","wand","graduation"][i]));
 fill(document.querySelector(".mentor-promo>span"),"crown");
 fill(document.querySelector(".mentorship-highlight>span"),"crown");
 document.querySelectorAll(".profile-actions>a,.profile-actions>button").forEach((el,i)=>{if(!el.querySelector(".ui-icon"))el.prepend(svg(["folder","graduation","chart","settings"][i]))});
 paintTheme();
 document.getElementById("memberThemeToggle")?.addEventListener("click",paintTheme);
 document.addEventListener("click",event=>{if(event.target.closest("[data-preference-theme]"))queueMicrotask(paintTheme)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
