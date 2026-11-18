/* Single admin shell: secure webinar workspace + read-only client directory.
   No data copies, merges, deletes or exports are performed automatically. */
(function(){
 "use strict";
 const webinarPages=[
  ["dashboard","Webinar Overview"],["analytics","Visitor Analytics"],
  ["engagement","Engagement"],["settings","Event Settings"],
  ["videos","Webinar Videos"],["content","Review Content"],
  ["registrations","Registrations"],["expo-clients","Expo Clients"],
  ["reviews","Review Results"],["learning","Learning Hub"],["downloads","Downloads"]
 ];
 const labelMap=Object.fromEntries(webinarPages);
 const labelSource={webinar:"Webinar",prompt:"Old Prompt Tool",expo:"Expo"};
 const $=id=>document.getElementById(id);
 let activeWebinarPage="dashboard",frameLoaded=false,leadsLoaded=false;
 let allLeads=[],visibleLeads=[];
 const isAuthorized=()=>typeof isLoggedIn!=="undefined"&&isLoggedIn===true&&
  typeof currentAdmin!=="undefined"&&currentAdmin?.is_admin===true&&
  typeof sb!=="undefined"&&!!sb;
 function setStatus(id,value){const e=$(id);if(e)e.textContent=value}
 function sendWebinarNav(){
  const frame=$("unifiedWebinarFrame");
  if(frame?.contentWindow&&frameLoaded){
   frame.contentWindow.postMessage({type:"sm:unified-webinar-nav",page:activeWebinarPage},location.origin);
   frame.contentWindow.postMessage({type:"sm:unified-webinar-theme",theme:document.documentElement.dataset.theme||"dark"},location.origin);
  }
 }
 function selectWebinarPage(page){
  if(!labelMap[page])return;
  activeWebinarPage=page;
  document.querySelectorAll("[data-unified-webinar]").forEach(btn=>{
   const selected=btn.dataset.unifiedWebinar===page;
   btn.classList.toggle("active",selected);
   btn.setAttribute("aria-pressed",String(selected));
  });
  const frame=$("unifiedWebinarFrame");
  if(!frame||!isAuthorized())return;
  if(!frame.getAttribute("src")){
   frameLoaded=false;
   setStatus("unifiedWebinarStatus","Opening authorized webinar workspace…");
   frame.src="/webinar-admin.html?embedded=1&view="+encodeURIComponent(page);
  }else sendWebinarNav();
 }
 async function loadLeads(force=false){
  if(!isAuthorized()){setStatus("unifiedLeadsStatus","Sign in as the authorized administrator.");return}
  if(leadsLoaded&&!force){renderLeads();return}
  setStatus("unifiedLeadsStatus","Loading original client records (read only)…");
  const sources=[
   ["webinar",sb.from("webinar_registrations").select("id,name,email,whatsapp,created_at").order("created_at",{ascending:false}).limit(1000)],
   ["prompt",sb.from("ai_tool_access_leads").select("id,name,email,whatsapp,created_at,access_source").order("created_at",{ascending:false}).limit(1000)],
   ["expo",sb.from("expo_clients").select("id,name,email,whatsapp,created_at").order("created_at",{ascending:false}).limit(1000)]
  ];
  try{
   const results=await Promise.all(sources.map(async ([key,promise])=>({key,...(await promise)})));
   const failure=results.find(r=>r.error);
   if(failure)throw Error("Cannot read "+labelSource[failure.key]+" records with admin permissions: "+failure.error.message);
   allLeads=results.flatMap(result=>(result.data||[]).map(x=>({
    id:x.id,source:result.key,name:String(x.name||""),
    email:String(x.email||""),whatsapp:String(x.whatsapp||""),created_at:x.created_at
   })));
   leadsLoaded=true;
   const counts=Object.fromEntries(sources.map(([key])=>[key,allLeads.filter(x=>x.source===key).length]));
   $("unifiedWebinarLeadCount").textContent=String(counts.webinar);
   $("unifiedPromptLeadCount").textContent=String(counts.prompt);
   $("unifiedExpoLeadCount").textContent=String(counts.expo);
   renderLeads();
  }catch(e){setStatus("unifiedLeadsStatus",e instanceof Error?e.message:"Unable to retrieve leads");}
 }
 function renderLeads(){
  const filter=$("unifiedLeadFilter")?.value||"all";
  const query=($("unifiedLeadSearch")?.value||"").trim().toLowerCase();
  visibleLeads=allLeads.filter(x=>(filter==="all"||x.source===filter)&&
   (!query||[x.name,x.email,x.whatsapp].some(v=>v.toLowerCase().includes(query))));
  visibleLeads.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const body=$("unifiedLeadsBody");if(!body)return;
  body.replaceChildren();
  for(const lead of visibleLeads){
   const tr=document.createElement("tr");
   for(const value of [lead.name,lead.email,lead.whatsapp,labelSource[lead.source],
    lead.created_at?new Date(lead.created_at).toLocaleString():"—"]){
    const td=document.createElement("td");td.textContent=value||"—";tr.appendChild(td);
   }
   body.appendChild(tr);
  }
  if(!visibleLeads.length){const row=document.createElement("tr"),cell=document.createElement("td");
   cell.colSpan=5;cell.textContent="No matching records.";row.appendChild(cell);body.appendChild(row)}
  setStatus("unifiedLeadsStatus",visibleLeads.length+" of "+allLeads.length+
   " original contact records shown. Same person may appear in multiple sources.");
 }
 function csvCell(value){
  const str=String(value??"");
  const guarded=/^[\s]*[=+\-@]/.test(str)?"'"+str:str;
  return '"'+guarded.replace(/"/g,'""')+'"';
 }
 function exportLeads(){
  if(!isAuthorized()||!leadsLoaded)return;
  const rows=[["Name","Email","WhatsApp","Source","Registered At"],...visibleLeads.map(x=>[
   x.name,x.email,x.whatsapp,labelSource[x.source],x.created_at||""
  ])];
  const body="\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="smshahid-clients-leads.csv";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
 }
 function onPage(page){
  if(!isAuthorized())return;
  if(page==="webinar")selectWebinarPage(activeWebinarPage);
  if(page==="leads")void loadLeads();
 }
 window.SMAdminUnified={onPage,selectWebinarPage,refreshLeads:()=>loadLeads(true)};
 document.addEventListener("DOMContentLoaded",()=>{
  const tabs=$("unifiedWebinarTabs");
  if(tabs){
   for(const [key,label] of webinarPages){
    const button=document.createElement("button");
    button.type="button";button.className="admin-unified-tab"+(key==="dashboard"?" active":"");
    button.dataset.unifiedWebinar=key;button.textContent=label;
    button.setAttribute("aria-pressed",String(key==="dashboard"));
    button.addEventListener("click",()=>selectWebinarPage(key));
    tabs.appendChild(button);
   }
  }
  const frame=$("unifiedWebinarFrame");
  frame?.addEventListener("load",()=>{frameLoaded=true;sendWebinarNav()});
  window.addEventListener("message",event=>{
   if(event.origin!==location.origin||!frame||event.source!==frame.contentWindow)return;
   const m=event.data||{};
   if(m.type==="sm:unified-webinar-height"&&Number.isFinite(m.height)){
    frame.style.height=Math.max(650,Math.min(20000,Math.ceil(m.height)+12))+"px";
   }else if(m.type==="sm:unified-webinar-ready"){
    setStatus("unifiedWebinarStatus","Webinar management is connected.");
    sendWebinarNav();
   }else if(m.type==="sm:unified-webinar-denied"){
    setStatus("unifiedWebinarStatus","Webinar access could not be verified. Please refresh your admin session.");
   }
  });
  $("unifiedLeadSearch")?.addEventListener("input",renderLeads);
  $("unifiedLeadFilter")?.addEventListener("change",renderLeads);
  $("unifiedLeadRefresh")?.addEventListener("click",()=>void loadLeads(true));
  $("unifiedLeadExport")?.addEventListener("click",exportLeads);
 });
})();
