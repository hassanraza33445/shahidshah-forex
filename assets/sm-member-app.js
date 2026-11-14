(()=>{"use strict";
const PROJECT="https://qggtdwixwafcmorepkks.supabase.co",KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const $=id=>document.getElementById(id),views=new Set(["home","markets","studio","tools","mentorship","profile"]);
const state={client:null,user:null,profile:null,news:[],calendar:[],filter:"All",source:"news",currentTab:"home",homeFilter:"All",marketPage:"feed",marketSearch:"",marketVisible:12,studioPage:"create",studioRole:null,studioStatus:"checking",studioFrame:null,studioFrameReady:false,applications:[]};
const safe=(value)=>String(value??"").slice(0,900);
const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
function tabFromLocation(){const requested=new URLSearchParams(location.search).get("tab")||"home";return requested==="library"?"studio":requested==="notifications"?"markets":views.has(requested)?requested:"home"}

const marketModules={feed:true};
const toolLabels={video:"Video Prompt Builder",article:"Article Prompt Builder",banner:"Banner Prompt Builder",indicator:"Indicator Prompt Builder"};
const sectionNames={home:"Dashboard",markets:"Market Intelligence",studio:"AI Studio & AI Scripts",tools:"Prompt Tools",mentorship:"Mentorship",profile:"My Profile"};
// Same-origin Studio uses the dashboard's already verified Supabase client.
// No duplicate login screen, temporary URL token, or postMessage credential handoff.
// Restrict to the exact managed Studio iframe window. All database RLS still applies.
window.__smStudioClientForFrame=(sourceWindow)=>{
 const frame=document.getElementById("unifiedStudioFrame");
 if(!state.client||!state.user||!frame||frame.contentWindow!==sourceWindow)return null;
 return state.client;
};

function setEmbeddedFrame(id,src,statusId){
 const frame=$(id),status=$(statusId);
 if(!frame||!status)return;
 if(frame.dataset.loadedSource===src)return;
 clearTimeout(frame._waitForReady);
 status.replaceChildren();
 status.hidden=false;status.textContent="Opening your prompt builder…";
 frame.dataset.loadedSource=src;
 frame.dataset.verified="false";
 frame.dataset.loaded="false";
 frame.style.visibility="hidden";
 frame.style.minHeight="0px";
 frame.style.height="0px"; // Prevent dark iframe overlays while auth resolves.
 frame.onload=()=>{
  if(frame.dataset.loadedSource!==src)return;
  frame.dataset.loaded="true";
  status.textContent="Preparing your prompt builder…";
  frame.contentWindow?.postMessage({type:"sm:theme",theme:document.documentElement.dataset.theme},location.origin);
 };
 const showRetry=()=>{
  if(frame.dataset.loadedSource!==src||frame.dataset.verified==="true")return;
  status.replaceChildren();
  status.append(create("span","","The prompt builder could not finish loading. "));
  const retry=create("button","embed-retry","Retry Prompt Builder");
  retry.type="button";
  retry.addEventListener("click",()=>{
   const url=new URL(src,location.origin);
   url.searchParams.set("retry",String(Date.now()));
   setEmbeddedFrame(id,url.pathname+url.search+url.hash,statusId);
  });
  status.append(retry);
 };
 frame.onerror=showRetry;
 frame._waitForReady=setTimeout(showRetry,12000);
 frame.src=src;
}
function renderMarketModule(){
 state.marketPage="feed";
 const feed=$("marketFeedArea");
 if(feed)feed.hidden=false;
}
function renderStudioAccess(){
 const allowed=state.studioStatus==="allowed",checking=state.studioStatus==="checking",error=state.studioStatus==="error";
 const studioGate=$("studioAccessState"),studioSlot=$("studioFrameSlot"),studioTabs=$("studioSubnav");
 studioGate.hidden=allowed;studioSlot.hidden=!allowed;
 studioTabs.hidden=!allowed;
 if(!allowed){
  studioGate.classList.toggle("is-checking",checking);
  studioGate.classList.toggle("is-error",error);
  studioGate.classList.toggle("is-denied",!checking&&!error);
  $("studioGateTitle").textContent=checking?"Verifying your private access…":error?"Your access could not be checked":"Free Creator access could not be verified";
  $("studioGateHint").textContent=checking?"Checking your account permissions securely.":error?"The permission service could not be reached. Your access status has not been confirmed.":"Every signed-in member receives free Creator access. Please retry your session check.";
  $("studioGateBadge").textContent=checking?"CHECKING":error?"CONNECTION ISSUE":"ACCESS CHECK";
  $("studioGateInstruction").textContent=checking?"Your account permissions are being checked. Creator features remain protected during verification.":error?"Check your connection and retry. If the issue continues, contact the platform administrator.":"Free Studio access is automatic. Retry the check, or sign out and sign in again if this persists.";
  const retry=$("studioRecheckAccess");
  retry.disabled=checking;
  retry.textContent=checking?"Checking permission…":error?"Retry Access Check ↻":"Retry Free Access Check ↻";
  retry.onclick=()=>{
   if(state.studioStatus==="checking"||!state.client||!state.user)return;
   state.studioStatus="checking";renderStudioAccess();
   void checkStudioAccess();
  };
 }
 if(allowed&&state.currentTab==="studio")mountStudio();
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
  const creator=["admin","creator","editor","approver"].includes(state.studioRole);
  document.querySelectorAll("#studioSubnav [data-studio-page]").forEach(button=>{if(button.dataset.studioPage==="create"){button.disabled=!creator;button.title=creator?"":"Creator access required"}});
  if(!creator&&state.studioPage==="create")state.studioPage="projects";
 }catch(_){state.studioRole=null;state.studioStatus="error"}
 renderStudioAccess();
}
function mountStudio(){
 if(state.studioStatus!=="allowed")return;
 const place=$("studioFrameSlot");
 const requested=state.studioPage;
 if(!state.studioFrame){
  const frame=document.createElement("iframe");
  frame.id="unifiedStudioFrame";frame.className="unified-studio-frame";frame.title="S M Shahid Shah AI Content Studio";
  frame.setAttribute("loading","eager");frame.setAttribute("allow","microphone; clipboard-write");
  state.studioFrame=frame;state.studioFrameReady=false;
  frame.addEventListener("load",()=>{
   state.studioFrameReady=true;
   frame.contentWindow?.postMessage({type:"sm:theme",theme:document.documentElement.dataset.theme},location.origin);
   frame.contentWindow?.postMessage({type:"sm:studio-nav",page:state.studioPage},location.origin);
  });
  const newsId=new URLSearchParams(location.search).get("news");
  frame.src="/content-studio/?embedded=1&ui=20261114-auth-pkt-v3&view="+encodeURIComponent(requested)+(newsId?"&news="+encodeURIComponent(newsId):"");
 }
 if(state.studioFrame.parentElement!==place)place.append(state.studioFrame);
 state.studioFrame.dataset.currentPage=requested;
 if(state.studioFrameReady)state.studioFrame.contentWindow?.postMessage({type:"sm:studio-nav",page:requested},location.origin);
 document.querySelectorAll("#studioSubnav [data-studio-page]").forEach(btn=>btn.classList.toggle("active",btn.dataset.studioPage===state.studioPage));
}
function showTool(tool,updateUrl=true){
 if(!Object.hasOwn(toolLabels,tool))return;
 const area=$("toolModuleArea");
 if(!area)return;
 area.hidden=false;
 $("activeToolName").textContent=toolLabels[tool];
 document.querySelectorAll("#view-tools .sm-prompt-tool-tab[data-tool]").forEach(button=>{
  const active=button.dataset.tool===tool;
  button.classList.toggle("active",active);
  button.setAttribute("aria-selected",String(active));
  button.tabIndex=active?0:-1;
 });
 const frame=$("toolModuleFrame");
 if(frame.dataset.verified==="true"&&frame.contentWindow){
  frame.contentWindow.postMessage({type:"sm:prompt-select",tool},location.origin);
 }else if(frame.dataset.loadedSource){
  // Keep the first iframe alive. Select the next builder when verified.
  frame.dataset.pendingTool=tool;
 }else{
  setEmbeddedFrame("toolModuleFrame","/learning-hub.html?embedded=1&premium_prompts=1&ui="+(window.matchMedia("(max-width:720px)").matches?"20261114-prompt-vip-1":"20261114-3")+"#"+encodeURIComponent(tool),"toolModuleStatus");
 }
 if(updateUrl&&state.currentTab==="tools"){
  const params=new URLSearchParams(location.search);
  params.set("tab","tools");params.set("tool",tool);
  history.replaceState({},"","/app/?"+params.toString());
 }
}
function openTab(name,push=true){
 if(name==="library"){name="studio";state.studioPage="projects"}
 if(name==="notifications")name="markets";
 if(!views.has(name))name="home";
 state.currentTab=name;
 for(const section of views) $("view-"+section)?.classList.toggle("active",section===name);
 document.querySelectorAll("[data-section]").forEach(node=>{
  const inNav=node.closest(".side-links,.mobile-dock")!==null;
  node.classList.toggle("active",inNav&&node.dataset.section===name);
 });
 $("currentSectionName").textContent=sectionNames[name]||"Dashboard";
 if(push){
  const params=new URLSearchParams();
  if(name!=="home")params.set("tab",name);
  if(name==="studio")params.set("studio",state.studioPage);
  history.replaceState({},"","/app/"+(params.size?"?"+params.toString():""));
 }
 closeMenu();
 if(typeof window.scrollTo==="function")window.scrollTo({top:0,behavior:"instant"});
 if(name==="mentorship")void refreshApplication();
 if(name==="markets")renderMarketModule();
 if(name==="studio")renderStudioAccess();
 if(name==="tools"&&!$("toolModuleFrame").dataset.loadedSource){const requested=new URLSearchParams(location.search).get("tool");showTool(Object.hasOwn(toolLabels,requested)?requested:"video",false)}
}
function closeMenu(){
 $("appSidebar").classList.remove("open");$("sideShade").hidden=true;$("openMenu").setAttribute("aria-expanded","false");
}
function setBusy(id,on){const el=$(id);if(el)el.disabled=on}
function formatTime(value){const d=new Date(value);return Number.isFinite(d.getTime())?
 new Intl.DateTimeFormat("en",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Karachi"}).format(d)+" PKT":"Time unavailable"}
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
 const hour=Number(new Intl.DateTimeFormat("en-GB",{hour:"2-digit",hourCycle:"h23",timeZone:"Asia/Karachi"}).format(new Date()));
 const greeting=hour<12?"Good Morning":hour<17?"Good Afternoon":"Good Evening";
 const isHandle=/^[a-z0-9_]{14,}$/.test(first)&&!name.includes(" ");
 if($("dashboardGreeting"))$("dashboardGreeting").textContent=greeting+(isHandle?"":", "+first);
 $("profileName").textContent=name;
 $("profileEmail").textContent=user.email||"";
 $("profileAvatar").textContent=first.charAt(0).toUpperCase();
 $("verifiedBadge").textContent=user.email_confirmed_at?"✓ Verified Account":"Email verification pending";
 $("mentorName").value=name;
 if(document.activeElement!==$("profileDisplayName"))$("profileDisplayName").value=name;
 $("profileEmailDetail").textContent=user.email||"—";
 $("profileAccountStatus").textContent=user.email_confirmed_at?"Email verified":"Email verification pending";
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
async function waitForSupabaseLibrary(){
 if(window.supabase?.createClient)return;
 await new Promise((resolve,reject)=>{
  let done=false;
  const finish=error=>{
   if(done)return;done=true;clearTimeout(timer);
   window.removeEventListener("sm:supabase-ready",ready);
   window.removeEventListener("sm:supabase-failed",failed);
   if(error)reject(error);else resolve();
  };
  const ready=()=>window.supabase?.createClient?finish():null;
  const failed=()=>finish(Error("Login service could not load. Check your connection and retry."));
  const timer=setTimeout(()=>finish(Error("Login service is taking too long to load.")),10500);
  window.addEventListener("sm:supabase-ready",ready);
  window.addEventListener("sm:supabase-failed",failed);
  ready();
 });
}
async function start(){
 try{
  await waitForSupabaseLibrary();
  const c=window.supabase.createClient(PROJECT,KEY);state.client=c;
  const {data,error}=await withTimeout(c.auth.getUser(),11000,"Secure login check took too long");
  if(error||!data?.user){goToLogin();return}
  const user=data.user;state.user=user;
  paintUser(user,null);
  $("year").textContent=String(new Date().getFullYear());
  $("memberApp").hidden=false;$("bootScreen").hidden=true;
  document.body.classList.remove("member-boot");
  const requested=new URLSearchParams(location.search);
  const studio=requested.get("studio");
  if(["dashboard","planner","record"].includes(studio))state.studioPage="create";else if(["create","projects"].includes(studio))state.studioPage=studio;
  if(requested.get("tab")==="library")state.studioPage="projects";
  openTab(tabFromLocation(),false);
  if(state.currentTab==="tools"&&Object.hasOwn(toolLabels,requested.get("tool")))showTool(requested.get("tool"),false);
  void checkStudioAccess();
  void loadNews();
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
function marketColorKey(category){
 const text=String(category||"").toLowerCase();
 if(/\bgold\b|\bxau\b|\bbullion\b/.test(text))return "gold";
 if(/\bforex\b|\bcurrenc|\bfx\b/.test(text))return "forex";
 if(/\bcrypto\b|\bbitcoin\b|\bbtc\b/.test(text))return "crypto";
 if(/\beconom|\bcentral\b|\bdata\b|\bfed\b|\bfomc\b/.test(text))return "economy";
 return "markets";
}
/* Dashboard stories are purpose-built editorial cards, not price/trend charts.
   Metadata and headlines come only from the live source-linked feed. */
function dashboardStoryCard(item){
 const article=create("article","dashboard-story-card");
 const source=String(item.category||"Markets");
 const headline=String(item.title||"Market update");
 const text=headline+" "+String(item.summary||"");
 const label=/\b(gold|bullion|xau)\b/i.test(text)?"Gold":
  /\b(bitcoin|btc|crypto|ethereum|eth)\b/i.test(text)?"Crypto":
  /^(forex)$/i.test(source)||/\b(usd\/jpy|eur\/usd|gbp\/usd|currency|forex|yen|dollar)\b/i.test(text)?"Forex":
  /^(economic data|economy|central banks)$/i.test(source)?"Economy":source;
 const icons={Gold:"▥",Crypto:"₿",Forex:"⇄",Economy:"▤"};
 const top=create("div","dashboard-story-top");
 article.classList.add("market-cat-"+marketColorKey(label));
 if(item.priority==="HOT")article.classList.add("market-is-hot");
 top.append(create("span","dashboard-story-icon",icons[label]||"▦"));
 top.append(create("span","dashboard-story-chip",item.priority==="HOT"?"HOT · "+label:label));
 article.append(top);
 const h=create("h3","dashboard-story-title");
 const title=create("button","dashboard-story-read",safe(headline));
 title.type="button";
 title.setAttribute("aria-label","Read news details: "+headline);
 title.addEventListener("click",()=>window.SMNewsReader?.open(item,{trigger:title}));
 h.append(title);article.append(h);
 const footer=create("div","dashboard-story-footer");
 footer.append(create("span","dashboard-story-calendar","▦"));
 footer.append(create("time","dashboard-story-time",formatTime(item.published_at||item.first_seen_at)));
 footer.append(create("span","dashboard-story-separator","·"));
 footer.append(create("span","dashboard-story-publisher",String(item.publisher||"Source-linked news").slice(0,70)));
 const read=create("button","dashboard-story-arrow","↗");
 read.type="button";
 read.setAttribute("aria-label","Read full story: "+headline);
 read.addEventListener("click",()=>window.SMNewsReader?.open(item,{trigger:read}));
 footer.append(read);
 article.append(footer);
 return article;
}

function miScore(item){
 const category=String(item?.category||"");
 return (item?.priority==="HOT"?6:0)+(["Gold","Forex","Economic Data"].includes(category)?3:0);
}
function miTopicMatch(item,category){
 if(category==="All")return true;
 const original=String(item.category||"").toLowerCase();
 const text=(String(item.title||"")+" "+String(item.summary||"")).toLowerCase();
 if(category==="Gold")return original==="gold"||/\b(gold|bullion|xau\/?usd|xau)\b/i.test(text);
 if(category==="Forex")return original==="forex"||/\b(forex|currency|currencies|usd|eur|gbp|jpy|yen|dollar|sterling|euro|dxy)\b/i.test(text);
 if(category==="Crypto")return original==="crypto"||/\b(bitcoin|btc|crypto|ethereum|eth)\b/i.test(text);
 if(category==="Economic Data")return ["economic data","economy","central banks"].includes(original)||/\b(inflation|interest rates?|rate hike|rate cut|cpi|ppi|gdp|fed|fomc|jobs report|payroll|central bank|employment|opec)\b/i.test(text);
 return original===String(category).toLowerCase();
}
function miNewsMatch(item){
 if(!miTopicMatch(item,state.filter))return false;
 const query=state.marketSearch.trim().toLowerCase();
 return !query||[item.title,item.summary,item.publisher,item.category].some(value=>String(value||"").toLowerCase().includes(query));
}
/* Consistent, image-free market card. All categories use identical markup and action placement. */
function marketNewsCard(item){
 const article=create("article","mi-equal-news-card");
 const top=create("div","mi-card-top");
 const categoryText=String(item.category||"Markets");
 const story=String(item.title||"")+" "+String(item.summary||"");
 const category=/\b(gold|bullion|xau)\b/i.test(story)&&/^(economy|economic data|central banks)$/i.test(categoryText)
  ?"Gold · Economy":/economic|central bank|economy/i.test(categoryText)?"Economy":categoryText;
 article.classList.add("market-cat-"+marketColorKey(category));
 if(item.priority==="HOT")article.classList.add("market-is-hot");
 top.append(create("span","mi-card-category",item.priority==="HOT"?"HOT · "+category:category));
 article.append(top);
 const title=create("h3","mi-card-title");
 const titleBtn=create("button","mi-card-title-btn",safe(item.title||"Market update"));
 titleBtn.type="button";
 titleBtn.setAttribute("aria-label","Read market news: "+safe(item.title));
 titleBtn.addEventListener("click",()=>window.SMNewsReader?.open(item,{trigger:titleBtn}));
 title.append(titleBtn);article.append(title);
 const rawSummary=String(item.summary||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
 const norm=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const name=norm(item.title),details=norm(rawSummary);
 const hasSummary=!!rawSummary&&details!==name&&!(name.length>24&&details.startsWith(name.slice(0,Math.min(60,name.length))))&&!name.startsWith(details);
 const summary=create("p","mi-card-excerpt",hasSummary?rawSummary.slice(0,240):"Headline only — no additional summary supplied.");
 if(!hasSummary)summary.classList.add("mi-card-excerpt-muted");
 article.append(summary);
 const source=create("div","mi-card-source");
 const publisher=String(item.publisher||"").trim();
 source.append(create("span","mi-card-publisher",publisher?publisher.slice(0,55):"Source-linked news"));
 source.append(create("span","mi-card-published",formatTime(item.published_at||item.first_seen_at)));
 article.append(source);
 const actions=create("div","mi-card-actions");
 const read=create("button","mi-card-read","Read Details →");
 read.type="button";
 read.addEventListener("click",()=>window.SMNewsReader?.open(item,{trigger:read}));
 actions.append(read);
 const link=create("a","mi-card-script","+ Create AI Script");
 link.href="/app/?tab=studio&studio=create"+(item.id?"&news="+encodeURIComponent(String(item.id)):"");
 link.setAttribute("aria-label","Open AI Script Studio for: "+safe(item.title));
 if(!item.id)link.title="Open AI Studio and select a news topic";
 actions.append(link);
 article.append(actions);
 return article;
}
function miBlank(message,detail){
 const wrapper=create("div","mi-empty-state");
 wrapper.append(create("strong","",message),create("p","",detail));
 return wrapper;
}
function renderMarketEditorial(){
 const grid=$("marketNewsList");if(!grid)return;
 grid.replaceChildren();
 const counts={All:state.news.length};
 for(const category of ["Forex","Gold","Crypto","Economic Data"])
  counts[category]=state.news.filter(item=>miTopicMatch(item,category)).length;
 document.querySelectorAll("[data-mi-category-count]").forEach(span=>{
  const n=counts[span.dataset.miCategoryCount]||0;
  span.textContent="("+n+")";
 });
 $("miTotalStories").textContent=state.news.length?String(state.news.length):"—";
 $("miPriorityStories").textContent=state.news.length?
  String(["Gold","Forex","Crypto","Economic Data"].filter(cat=>counts[cat]>0).length):"—";
 const filtered=state.news.filter(miNewsMatch);
 const sorted=filtered.map((item,index)=>({item,index}))
  .sort((a,b)=>miScore(b.item)-miScore(a.item)||a.index-b.index)
  .map(pair=>pair.item);
 $("miResultCount").textContent=filtered.length+" matching headlines";
 if(!sorted.length){
  grid.append(miBlank(state.news.length?"No matching headlines":"News feed unavailable",
   state.news.length?"Try another category or search keyword.":"Headlines could not be loaded. Please try again later."));
  $("miLoadMore").hidden=true;
 }else{
  for(const item of sorted.slice(0,state.marketVisible))grid.append(marketNewsCard(item));
  $("miLoadMore").hidden=sorted.length<=state.marketVisible;
  $("miLoadMore").textContent="View More Headlines ("+
   Math.min(12,Math.max(0,sorted.length-state.marketVisible))+" more) ↓";
 }
 const coverage=$("miCoverageList");
 if(coverage){
  coverage.replaceChildren();
  const labels={Gold:"Gold / XAU",Forex:"Currencies / Forex",Crypto:"Crypto Markets","Economic Data":"Economy & Central Banks"};
  for(const category of ["Gold","Forex","Crypto","Economic Data"]){
   const row=create("button","mi-coverage-row");row.type="button";
   const topic=create("span","mi-topic-wrap");
   const pictograms={Gold:"▰",Forex:"⇄",Crypto:"₿","Economic Data":"▤"};
   topic.append(create("span","mi-topic-symbol",pictograms[category]),create("span","mi-topic-name",labels[category]));
   row.append(topic,create("span","mi-topic-count",counts[category]+" articles"));
   row.addEventListener("click",()=>{
    state.filter=category;state.marketSearch="";state.marketVisible=12;
    $("miSearch").value="";
    document.querySelectorAll("[data-news-filter]").forEach(btn=>{
     const active=btn.dataset.newsFilter===category;
     btn.classList.toggle("active",active);
     btn.setAttribute("aria-pressed",String(active));
    });
    renderNews();
    $("miResultCount").scrollIntoView({block:"nearest",behavior:"smooth"});
   });
   coverage.append(row);
  }
 }
}
function renderNews(){
 const small=$("homeHeadlines");
 small.replaceChildren();
 const score=x=>(x.priority==="HOT"?6:0)+(["Gold","Forex","Economic Data"].includes(x.category)?3:0);
 const homePool=state.homeFilter==="All"?state.news:state.news.filter(x=>miTopicMatch(x,state.homeFilter));
 const latest=homePool.map((item,index)=>({item,index})).sort((a,b)=>score(b.item)-score(a.item)||a.index-b.index).slice(0,3).map(x=>x.item);
 if(!latest.length)small.append(create("div","loading-line",state.news.length?"No recent stories in this category.":"News temporarily unavailable. Visit Market Intelligence."));
 for(const item of latest)small.append(dashboardStoryCard(item));
 renderMarketEditorial();
}
async function loadNews(){
 let loaded=false;
 try{
  const v=await api("market-intelligence-api?mode=feed&limit=36&page=1");
  state.news=v.items||[];$("newsCount").textContent=String(state.news.length);
  $("hotCount").textContent=String(["Gold","Forex","Crypto","Economic Data"].filter(topic=>state.news.some(item=>miTopicMatch(item,topic))).length);
  renderNews();loaded=true;
  $("miFeedStatus").textContent="Headlines available";
 }catch(e){
  $("newsCount").textContent="—";$("hotCount").textContent="—";renderNews();
  $("miFeedStatus").textContent="News source temporarily unavailable";
 }
 window.dispatchEvent(new CustomEvent("sm:premium-news",{detail:{items:state.news}}));
 $("lastUpdated").textContent=loaded?new Intl.DateTimeFormat("en",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Karachi"}).format(new Date()):"Unavailable";
 $("miFeedUpdated").textContent=loaded?"Last checked "+$("lastUpdated").textContent+" PKT · Source-linked headlines":"Retry after checking your connection";
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
 const mobilePaid=window.matchMedia("(max-width:720px)").matches;
 let latestPayment=null;
 if(mobilePaid&&latest){
  const {data:payments,error:paymentError}=await state.client.from("mentorship_payment_submissions")
   .select("application_id,payment_status,amount_usdt,network,submitted_at")
   .eq("user_id",state.user.id).eq("application_id",latest.id).order("submitted_at",{ascending:false}).limit(1);
  if(!paymentError)latestPayment=payments?.[0]||null;
  if(latestPayment){
   const status=String(latestPayment.payment_status||"submitted");
   const label=status==="verified"?"PAYMENT VERIFIED":status==="rejected"?"PAYMENT REVIEW NEEDED":"PAYMENT UNDER REVIEW";
   $("applicationStatus").textContent=label;
   $("applicationDetail").textContent=
    "USDT "+Number(latestPayment.amount_usdt).toFixed(2)+" on "+latestPayment.network+
    " · "+(status==="verified"?"Payment verified. Mentorship approval is handled separately.":status==="rejected"?"Payment could not be verified. Contact the team.":"Transaction submitted for manual verification. Not yet approved.");
  }else if(latest.status==="pending"){
   $("applicationDetail").textContent="Application is pending. Continue to USDT Payment to submit your transaction for verification.";
  }
 }
 $("mentorSubmit").disabled=Boolean(latest&&["pending","reviewing"].includes(latest.status)&&(!mobilePaid||Boolean(latestPayment)));
 if($("mentorSubmit").disabled&&!mobilePaid)$("mentorMessage").textContent="You already have an application awaiting review.";
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
 if(typeof window.SMSetupPaidMentorship==="function"){
   window.SMSetupPaidMentorship({
     getClient:()=>state.client,
     getUser:()=>state.user,
     getProfile:()=>state.profile,
     refreshApplication
   });
 }
}

function setupProfile(){
 document.querySelectorAll("[data-preference-theme]").forEach(button=>button.addEventListener("click",()=>setMemberTheme(button.dataset.preferenceTheme)));
 $("profileNameForm").addEventListener("submit",async event=>{
  event.preventDefault();if(!state.client||!state.user)return;
  const value=$("profileDisplayName").value.trim(),status=$("profileNameStatus");
  status.className="settings-help";status.textContent="Saving your display name…";
  if(value.length<2||value.length>90){status.textContent="Please enter a name between 2 and 90 characters.";status.classList.add("error");return}
  setBusy("profileSaveName",true);
  try{
   if(!state.client.auth.updateUser)throw Error("Profile editing is temporarily unavailable. Please try again later.");
   const result=await withTimeout(state.client.auth.updateUser({data:{full_name:value}}),12000,"Profile update timed out");
   if(result.error)throw result.error;
   state.user.user_metadata={...(state.user.user_metadata||{}),full_name:value};
   let synced=true;
   try{
    const updated=await withTimeout(state.client.from("profiles").update({full_name:value}).eq("id",state.user.id),10000,"Profile sync timed out");
    if(updated.error)synced=false;
   }catch(_){synced=false}
   state.profile={...(state.profile||{}),full_name:value};
   paintUser(state.user,state.profile);
   status.className="settings-help "+(synced?"success":"error");
   status.textContent=synced?"Display name updated successfully.":"Login name updated; profile database sync could not be verified. If the old name reappears, contact support.";
  }catch(e){status.className="settings-help error";status.textContent=e.message||"Unable to update name. Please retry."}
  finally{setBusy("profileSaveName",false)}
 });
}

function setupNavigation(){
 document.querySelectorAll("[data-section]").forEach(button=>button.addEventListener("click",event=>{if(button.tagName==="A")event.preventDefault();
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
  if(button.disabled)return;
  if(state.currentTab==="studio")history.replaceState({},"","/app/?tab=studio&studio="+encodeURIComponent(state.studioPage));
  if(state.studioStatus==="allowed")mountStudio();
  else renderStudioAccess();
 }));
 document.querySelectorAll("[data-tool]:not([data-section])").forEach(button=>button.addEventListener("click",()=>{
  openTab("tools");showTool(button.dataset.tool);
 }));
 const promptNav=document.querySelector("#view-tools .sm-prompt-tool-tabs");
 if(promptNav)promptNav.addEventListener("keydown",event=>{
  if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;
  const buttons=[...promptNav.querySelectorAll(".sm-prompt-tool-tab[data-tool]:not(:disabled)")];
  const active=document.activeElement;
  const index=buttons.indexOf(active);
  if(index<0||!buttons.length)return;
  event.preventDefault();
  const next=event.key==="Home"?0:event.key==="End"?buttons.length-1:
   (index+(event.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;
  const target=buttons[next];
  target.focus();showTool(target.dataset.tool);
 });
 $("closeToolModule").addEventListener("click",()=>{$("toolModuleArea").hidden=true});
 document.querySelectorAll("[data-home-filter]").forEach(button=>button.addEventListener("click",()=>{
  state.homeFilter=button.dataset.homeFilter;
  document.querySelectorAll("[data-home-filter]").forEach(x=>{x.classList.toggle("active",x===button);x.setAttribute("aria-pressed",String(x===button))});
  renderNews();
 }));
 document.querySelectorAll("[data-news-filter]").forEach(button=>button.addEventListener("click",()=>{
  state.filter=button.dataset.newsFilter;state.marketVisible=12;
  document.querySelectorAll("[data-news-filter]").forEach(x=>{x.classList.toggle("active",x===button);x.setAttribute("aria-pressed",String(x===button))});
  renderNews();
 }));
 $("miSearch").addEventListener("input",e=>{state.marketSearch=e.target.value.slice(0,100);state.marketVisible=12;renderNews()});
 $("miLoadMore").addEventListener("click",()=>{state.marketVisible+=12;renderNews()});
 $("openMenu").addEventListener("click",()=>{
  const opened=$("appSidebar").classList.toggle("open");$("sideShade").hidden=!opened;
  $("openMenu").setAttribute("aria-expanded",String(opened));
 });
 $("sideShade").addEventListener("click",closeMenu);
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});
 window.addEventListener("popstate",()=>openTab(tabFromLocation(),false));
 window.addEventListener("message",event=>{
  if(event.origin!==location.origin||!event.data||typeof event.data!=="object")return;
  // The main dashboard has already verified the login with auth.getUser().
  // Same-origin embedded modules request only a yes/no UI acknowledgement;
  // never transmit credentials, tokens or privileged user information.
  if(event.data.type==="sm:embed-auth-request"){
   const knownFrames=["toolModuleFrame","unifiedStudioFrame","marketModuleFrame","noticeFrame"]
    .map(id=>$(id)).filter(Boolean);
   const known=knownFrames.some(frame=>frame.contentWindow===event.source);
   if(known){
    event.source.postMessage({type:"sm:embed-auth-response",allowed:!!state.user},location.origin);
   }
   return;
  }
  if(event.data.type==="sm:embed-view-ready"){
   const frame=$("toolModuleFrame");
   if(frame&&frame.contentWindow===event.source){
    frame.dataset.verified="true";clearTimeout(frame._waitForReady);
    frame.style.visibility="visible";
    frame.style.minHeight="";
    frame.style.height=frame.dataset.lastEmbedHeight||"700px";
    $("toolModuleStatus").hidden=true;
    if(frame.dataset.pendingTool){
     frame.contentWindow.postMessage({type:"sm:prompt-select",tool:frame.dataset.pendingTool},location.origin);
     delete frame.dataset.pendingTool;
    }
   }
   return;
  }
  if(event.data.type==="sm:embed-height"){
   const frames=["unifiedStudioFrame","marketModuleFrame","toolModuleFrame","noticeFrame"];
   const target=frames.map(id=>$(id)).find(frame=>frame&&frame.contentWindow===event.source);
   const height=Number(event.data.height);
   if(target&&Number.isFinite(height)&&height>200&&height<18000){
    const pixels=Math.ceil(height+12)+"px";target.dataset.lastEmbedHeight=pixels;
    if(target.id!=="toolModuleFrame"||target.dataset.verified==="true")target.style.height=pixels;
   }
   return;
  }
  if(event.data.type==="sm:studio-page"&&state.currentTab==="studio"&&["create","projects"].includes(event.data.page)){
   state.studioPage=event.data.page;
   document.querySelectorAll("#studioSubnav [data-studio-page]").forEach(b=>b.classList.toggle("active",b.dataset.studioPage===state.studioPage));
  }
  if(event.data.type==="sm:open-module"){
   const view=event.data.view;
   if(view==="markets"){state.marketPage="feed";openTab("markets")}
   else if(views.has(view))openTab(view);
  }
 });
 $("logout").addEventListener("click",async()=>{
  setBusy("logout",true);try{await state.client.auth.signOut()}finally{location.replace("/")}
 });
}
setupNavigation();setupMentorship();setupTheme();setupProfile();start();
})();