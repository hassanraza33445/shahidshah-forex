(()=>{"use strict";
const PROJECT="https://qggtdwixwafcmorepkks.supabase.co",KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const $=id=>document.getElementById(id),views=new Set(["home","markets","studio","tools","mentorship","library","notifications","profile"]);
const state={client:null,user:null,profile:null,news:[],calendar:[],filter:"All",source:"news",currentTab:"home",marketPage:"feed",studioPage:"create",studioRole:null,studioStatus:"checking",studioFrame:null,studioFrameReady:false,applications:[]};
const safe=(value)=>String(value??"").slice(0,900);
const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
function tabFromLocation(){const requested=new URLSearchParams(location.search).get("tab")||"home";return views.has(requested)?requested:"home"}

const marketModules={
 hub:"/market-intelligence/?embedded=1",
 calendar:"/economic-calendar/?embedded=1",
 reaction:"/market-reaction/?embedded=1",
 alerts:"/notifications/?embedded=1"
};
const toolLabels={video:"Video Prompt Builder",article:"Article Prompt Builder",banner:"Banner Prompt Builder",indicator:"Indicator Prompt Builder"};
const sectionNames={home:"Dashboard",markets:"Market Intelligence",studio:"AI Studio",tools:"Prompt Tools",mentorship:"Mentorship",library:"My Content",notifications:"Notifications",profile:"My Profile"};
function setEmbeddedFrame(id,src,statusId){
 const frame=$(id),status=$(statusId);
 if(!frame)return;
 if(frame.dataset.loadedSource===src)return;
 status.hidden=false;status.textContent="Opening secure workspace module…";
 frame.dataset.loadedSource=src;
 frame.onload=()=>{if(frame.dataset.loadedSource===src){status.hidden=true;frame.dataset.loaded="true";frame.contentWindow?.postMessage({type:"sm:theme",theme:document.documentElement.dataset.theme},location.origin)}};
 frame.onerror=()=>{status.hidden=false;status.textContent="This module could not load. Reopen it or check your connection."};
 frame.src=src;
}
function renderMarketModule(){
 const selected=state.marketPage in marketModules?state.marketPage:"feed";
 document.querySelectorAll("#view-markets [data-market-page]").forEach(btn=>btn.classList.toggle("active",btn.dataset.marketPage===selected));
 $("marketFeedArea").hidden=selected!=="feed";
 $("marketModuleArea").hidden=selected==="feed";
 if(selected!=="feed")setEmbeddedFrame("marketModuleFrame",marketModules[selected],"marketModuleStatus");
}
function renderStudioAccess(){
 const allowed=state.studioStatus==="allowed";
 for(const [view,gateId,slotId] of [["studio","studioAccessState","studioFrameSlot"],["library","libraryAccessState","libraryFrameSlot"]]){
  const gate=$(gateId),slot=$(slotId);
  gate.hidden=allowed;
  slot.hidden=!allowed;
  if(!allowed){
   gate.replaceChildren();
   const title=create("strong","",state.studioStatus==="checking"?"Verifying your Studio access…":state.studioStatus==="error"?"Studio access could not be checked":"Studio access is restricted");
   const hint=create("p","",state.studioStatus==="checking"?"Your account is being verified securely.":state.studioStatus==="error"?"Your connection or permission service is unavailable. Please retry.":"Only accounts granted Studio access by the administrator can use the creator workspace.");
   gate.append(title,hint);
   if(state.studioStatus==="error"){
    const retry=create("button","outline-action","Retry Access Check");retry.type="button";retry.addEventListener("click",()=>{state.studioStatus="checking";renderStudioAccess();void checkStudioAccess()});gate.append(retry);
   }
  }
 }
 if(allowed&&(state.currentTab==="studio"||state.currentTab==="library"))mountStudio();
}
async function checkStudioAccess(){
 if(!state.client||!state.user)return;
 try{
  const user=state.user,client=state.client;
  const [pro,access]=await Promise.allSettled([
   withTimeout(client.from("profiles").select("full_name,email,is_admin,avatar_url").eq("id",user.id).maybeSingle(),6500,"Profile check timed out"),
   withTimeout(client.from("content_access").select("enabled,role").eq("user_id",user.id).maybeSingle(),6500,"Studio permissions check timed out")
  ]);
  if(pro.status==="fulfilled"&&!pro.value.error&&pro.value.data){state.profile=pro.value.data;paintUser(user,pro.value.data)}
  if(pro.status==="rejected"&&access.status==="rejected")throw Error("Permission service unavailable");
  if(access.status==="rejected"||access.value?.error){
   if(pro.status!=="fulfilled"||pro.value?.data?.is_admin!==true)throw Error("Studio permissions unavailable");
  }
  const admin=pro.status==="fulfilled"&&pro.value?.data?.is_admin===true;
  const permitted=access.status==="fulfilled"&&!access.value.error&&access.value?.data?.enabled===true;
  state.studioRole=admin?"admin":permitted?access.value.data.role:null;
  state.studioStatus=state.studioRole?"allowed":"denied";
 }catch(_){state.studioRole=null;state.studioStatus="error"}
 renderStudioAccess();
}
function mountStudio(){
 if(state.studioStatus!=="allowed")return;
 const isLibrary=state.currentTab==="library";
 const place=$("studioFrameSlot");
 const requested=isLibrary?"projects":state.studioPage;
 if(!state.studioFrame){
  const frame=document.createElement("iframe");
  frame.id="unifiedStudioFrame";frame.className="unified-studio-frame";frame.title="S M Shahid Shah AI Content Studio";
  frame.setAttribute("loading","eager");frame.setAttribute("allow","microphone; clipboard-write");
  state.studioFrame=frame;
  state.studioFrameReady=false;
  frame.addEventListener("load",()=>{
   state.studioFrameReady=true;
   frame.contentWindow?.postMessage({type:"sm:theme",theme:document.documentElement.dataset.theme},location.origin);
   frame.contentWindow?.postMessage({type:"sm:studio-nav",page:state.currentTab==="library"?"projects":state.studioPage},location.origin);
  });
  frame.src="/content-studio/?embedded=1&view="+encodeURIComponent(requested);
 }
 place.append(state.studioFrame);
 state.studioFrame.dataset.currentPage=requested;
 if(state.studioFrameReady)state.studioFrame.contentWindow?.postMessage({type:"sm:studio-nav",page:requested},location.origin);
 document.querySelectorAll("#studioSubnav [data-studio-page]").forEach(btn=>btn.classList.toggle("active",btn.dataset.studioPage===state.studioPage));
}
function showTool(tool){
 if(!(tool in toolLabels))return;
 const area=$("toolModuleArea");
 area.hidden=false;$("activeToolName").textContent=toolLabels[tool];
 setEmbeddedFrame("toolModuleFrame","/learning-hub.html?embedded=1#"+tool,"toolModuleStatus");
 area.scrollIntoView({behavior:"smooth",block:"start"});
}
function openTab(name,push=true){
 if(!views.has(name))name="home";
 state.currentTab=name;
 for(const section of views)$("view-"+section)?.classList.toggle("active",section===name||(section==="studio"&&name==="library"));
 if(name==="library")$("view-library")?.classList.remove("active");
 $("studioTitle").innerHTML=name==="library"?"My <em>Content.</em>":"AI <em>Studio.</em>";
 $("studioSubnav").hidden=name==="library";
 document.querySelectorAll("[data-section]").forEach(node=>node.classList.toggle("active",node.dataset.section===name&&node.closest(".side-links,.mobile-dock")!==null));
 $("currentSectionName").textContent=sectionNames[name]||"Dashboard";
 if(push)history.replaceState({},"",name==="home"?"/app/":"/app/?tab="+encodeURIComponent(name));
 closeMenu();
 if(typeof window.scrollTo==="function")window.scrollTo({top:0,behavior:"instant"});
 if(name==="mentorship")void refreshApplication();
 if(name==="markets")renderMarketModule();
 if(name==="studio"||name==="library")renderStudioAccess();
 if(name==="notifications")setEmbeddedFrame("noticeFrame","/notifications/?embedded=1","noticeFrameStatus");
}
function closeMenu(){
 $("appSidebar").classList.remove("open");$("sideShade").hidden=true;$("openMenu").setAttribute("aria-expanded","false");
}
function setBusy(id,on){const el=$(id);if(el)el.disabled=on}
function formatTime(value){const d=new Date(value);return Number.isFinite(d.getTime())?
 new Intl.DateTimeFormat("en",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kuala_Lumpur"}).format(d):"Time unavailable"}
function domainSource(value){try{const u=new URL(value);return u.protocol==="https:"?u.hostname.replace(/^www\./,""):"External source"}catch{return"Source"}}
function hrefSafe(input){try{const u=new URL(input,location.origin);return u.protocol==="https:"||u.origin===location.origin&&u.protocol==="http:"?u.href:"#"}catch{return"#"}}
async function api(path){
 const response=await fetch(PROJECT+"/functions/v1/"+path,{headers:{apikey:KEY},signal:AbortSignal.timeout(13500)});
 if(!response.ok)throw Error("Unable to load API");
 const body=await response.json();if(!body.success)throw Error(body.error||"Data unavailable");return body;
}
function nameFor(user,profile){
 const full=(profile?.full_name||user?.user_metadata?.full_name||user?.user_metadata?.name||"").trim();
 if(full&&full.length<=90)return full;return user?.email?.split("@")[0]||"Member";
}

function withTimeout(request,ms,label){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(label)),ms);
  Promise.resolve(request).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)});
 });
}
function paintUser(user,profile){
 const name=nameFor(user,profile),first=name.split(/\s+/)[0]||"Member";
 $("greeting").textContent="Welcome Back, "+first+" 👋";
 $("profileName").textContent=name;
 $("profileEmail").textContent=user.email||"";
 $("profileAvatar").textContent=first.charAt(0).toUpperCase();
 $("verifiedBadge").textContent=user.email_confirmed_at?"✓ Verified Account":"Email verification pending";
 $("mentorName").value=name;
}
function setMemberTheme(theme){
 const next=theme==="dark"?"dark":"light";
 document.documentElement.dataset.theme=next;
 const toggle=$("memberThemeToggle");
 if(toggle){toggle.textContent=next==="dark"?"☀":"☾";toggle.setAttribute("aria-label",next==="dark"?"Switch to light theme":"Switch to dark theme");toggle.title=toggle.getAttribute("aria-label")}
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=next==="dark"?"#100e0a":"#FBF7EF";
 try{localStorage.setItem("smshahid-site-theme",next);localStorage.setItem("site-theme",next)}catch(_){}
 for(const id of ["unifiedStudioFrame","marketModuleFrame","toolModuleFrame","noticeFrame"]){const frame=$(id);if(frame?.contentWindow)frame.contentWindow.postMessage({type:"sm:theme",theme:next},location.origin)}
}
function setupTheme(){
 setMemberTheme(document.documentElement.dataset.theme);
 $("memberThemeToggle").addEventListener("click",()=>setMemberTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
}
async function start(){
 try{
  if(!window.supabase?.createClient)throw Error("Login library could not load");
  const c=window.supabase.createClient(PROJECT,KEY);state.client=c;
  const {data,error}=await withTimeout(c.auth.getUser(),11000,"Secure login check took too long");
  if(error||!data?.user){goToLogin();return}
  const user=data.user;state.user=user;
  paintUser(user,null);
  $("year").textContent=String(new Date().getFullYear());
  $("memberApp").hidden=false;$("bootScreen").hidden=true;
  document.body.classList.remove("member-boot");
  openTab(tabFromLocation(),false);
  void checkStudioAccess();
  void Promise.allSettled([loadNews(),loadEconomic(),loadAlerts()]);
 }catch(e){
  const screen=$("bootScreen");
  screen.replaceChildren(create("img","boot-avatar"));
  screen.firstChild.src="/shahid-shah-profile.jpg";screen.firstChild.alt="S M Shahid Shah";
  screen.append(create("strong","","Unable to open your workspace"));
  screen.append(create("small","",safe(e?.message||"Please check your connection.")));
  const retry=create("a","boot-retry","Try Again");retry.href="/app/";screen.append(retry);
  const login=create("a","boot-login","Back to Login");login.href="/auth/?next=%2Fapp%2F";screen.append(login);
 }
}
function goToLogin(){location.replace("/auth/?next="+encodeURIComponent("/app/"+location.search))}
function headlineCard(item){
 const article=create("article","news-card");
 const chip=create("span","chip",item.priority==="HOT"?"HOT · VERIFY SOURCE":item.category||"Markets");article.append(chip);
 const title=create("h3","",safe(item.title));article.append(title);
 const description=(item.summary||"").replace(/<[^>]*>/g," ").trim();
 if(description)article.append(create("p","",description.slice(0,150)));
 const foot=create("div","news-foot");
 foot.textContent=domainSource(item.original_url)+" · "+formatTime(item.published_at||item.first_seen_at);
 article.append(foot);
 const link=create("a","outline-action","Original Source ↗");link.href=hrefSafe(item.original_url);link.target="_blank";link.rel="noopener noreferrer";
 link.style.cssText="margin-top:10px;align-self:flex-start;padding:8px 12px;font-size:10px";article.append(link);
 return article;
}
function renderNews(){
 const small=$("homeHeadlines"),big=$("marketNewsList");
 small.replaceChildren();big.replaceChildren();
 const latest=state.news.slice(0,3);
 if(!latest.length){
  small.append(create("div","loading-line","News temporarily unavailable. Visit the Market Intelligence hub."));
  big.append(create("div","loading-line","No recent headlines available for this filter."));return;
 }
 for(const item of latest)small.append(headlineCard(item));
 const filtered=state.filter==="All"?state.news:state.news.filter(x=>x.category===state.filter);
 if(!filtered.length)big.append(create("div","loading-line","No headlines for this category right now."));
 for(const item of filtered.slice(0,18))big.append(headlineCard(item));

}
async function loadNews(){
 try{
  const v=await api("market-intelligence-api?mode=feed&limit=36&page=1");
  state.news=v.items||[];$("newsCount").textContent=String(state.news.length);
  renderNews();
 }catch(e){
  $("newsCount").textContent="—";renderNews();
 }
 $("lastUpdated").textContent=new Intl.DateTimeFormat("en",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kuala_Lumpur"}).format(new Date());
}
async function loadEconomic(){
 try{
  const r=await api("economic-calendar-api?mode=events");
  state.calendar=(r.items||[]).filter(x=>new Date(x.scheduled_at).getTime()>=Date.now());
  $("calendarCount").textContent=String(state.calendar.length);
 }catch(e){$("calendarCount").textContent="—"}
}
async function loadAlerts(){
 try{
  const r=await api("market-notifications-api?mode=feed&limit=30");
  const hot=(r.items||[]).filter(x=>x.kind==="breaking_news");
  $("hotCount").textContent=String(hot.length);
  $("alertDot").hidden=hot.length===0;
 }catch(e){$("hotCount").textContent="—";$("alertDot").hidden=true}
}
async function refreshApplication(){
 if(!state.client||!state.user)return;
 const {data,error}=await state.client.from("member_mentorship_applications").select("id,status,created_at,interest").eq("user_id",state.user.id).order("created_at",{ascending:false}).limit(1);
 if(error){$("applicationStatus").textContent="Status unavailable";$("applicationDetail").textContent="Please try again later.";return}
 state.applications=data||[];
 const latest=state.applications[0];
 $("applicationStatus").textContent=latest?latest.status.toUpperCase():"Not Applied";
 $("applicationDetail").textContent=latest?
  "Application for "+latest.interest+" submitted "+formatTime(latest.created_at)+". We will review and contact you.":
  "You haven't submitted a mentorship application yet.";
 $("mentorSubmit").disabled=Boolean(latest&&["pending","reviewing"].includes(latest.status));
 if($("mentorSubmit").disabled)$("mentorMessage").textContent="You already have an application awaiting review.";
}
function setupMentorship(){
 $("mentorshipForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!state.user||!state.client)return;
  $("mentorMessage").textContent="Submitting your application…";setBusy("mentorSubmit",true);
  const row={
   user_id:state.user.id,full_name:$("mentorName").value.trim(),whatsapp:$("mentorPhone").value.trim(),
   contact_email:state.user.email||"",interest:$("mentorInterest").value,goals:$("mentorGoals").value.trim()
  };
  try{
   if(row.full_name.length<2||row.whatsapp.length<6||row.goals.length<12)throw Error("Please complete all fields.");
   const {data:existing}=await state.client.from("member_mentorship_applications").select("id,status").eq("user_id",state.user.id).in("status",["pending","reviewing"]).limit(1);
   if(existing?.length)throw Error("You already have an application awaiting review.");
   const {error}=await state.client.from("member_mentorship_applications").insert(row);
   if(error)throw error;
   $("mentorMessage").textContent="Application submitted successfully. Your status is Pending Review.";
   await refreshApplication();
  }catch(error){$("mentorMessage").textContent=error.message||"Unable to submit. Try again."}
  finally{if(!$("mentorMessage").textContent.includes("awaiting review"))setBusy("mentorSubmit",false)}
 });
}
function setupNavigation(){
 document.querySelectorAll("[data-section]").forEach(button=>button.addEventListener("click",()=>{
  if(button.dataset.marketPage)state.marketPage=button.dataset.marketPage;
  if(button.dataset.studioPage)state.studioPage=button.dataset.studioPage;
  openTab(button.dataset.section);
  if(button.dataset.tool)showTool(button.dataset.tool);
 }));
 document.querySelectorAll("#view-markets [data-market-page]").forEach(button=>button.addEventListener("click",()=>{
  state.marketPage=button.dataset.marketPage;renderMarketModule();
 }));
 document.querySelectorAll("#studioSubnav [data-studio-page]").forEach(button=>button.addEventListener("click",()=>{
  state.studioPage=button.dataset.studioPage;
  if(state.studioStatus==="allowed")mountStudio();
  else renderStudioAccess();
 }));
 document.querySelectorAll("[data-tool]:not([data-section])").forEach(button=>button.addEventListener("click",()=>{
  openTab("tools");showTool(button.dataset.tool);
 }));
 $("closeToolModule").addEventListener("click",()=>{$("toolModuleArea").hidden=true});
 document.querySelectorAll("[data-news-filter]").forEach(button=>button.addEventListener("click",()=>{
  state.filter=button.dataset.newsFilter;
  document.querySelectorAll("[data-news-filter]").forEach(x=>x.classList.toggle("active",x===button));
  renderNews();
 }));
 $("openMenu").addEventListener("click",()=>{
  const opened=$("appSidebar").classList.toggle("open");$("sideShade").hidden=!opened;
  $("openMenu").setAttribute("aria-expanded",String(opened));
 });
 $("sideShade").addEventListener("click",closeMenu);
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});
 window.addEventListener("popstate",()=>openTab(tabFromLocation(),false));
 window.addEventListener("message",event=>{
  if(event.origin!==location.origin||!event.data||typeof event.data!=="object")return;
  if(event.data.type==="sm:studio-page"&&state.currentTab==="studio"&&["dashboard","create","projects","planner","record"].includes(event.data.page)){
   state.studioPage=event.data.page;
   document.querySelectorAll("#studioSubnav [data-studio-page]").forEach(b=>b.classList.toggle("active",b.dataset.studioPage===state.studioPage));
  }
  if(event.data.type==="sm:open-module"){
   const view=event.data.view;
   if(view==="markets"){state.marketPage=Object.hasOwn(marketModules,event.data.page)?event.data.page:"feed";openTab("markets")}
   else if(views.has(view))openTab(view);
  }
 });
 $("logout").addEventListener("click",async()=>{
  setBusy("logout",true);try{await state.client.auth.signOut()}finally{location.replace("/")}
 });
}
setupNavigation();setupMentorship();setupTheme();start();
})();