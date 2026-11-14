(()=>{"use strict";
const PROJECT="https://qggtdwixwafcmorepkks.supabase.co",KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const $=id=>document.getElementById(id),views=new Set(["home","markets","studio","tools","mentorship","library","profile"]);
const state={client:null,user:null,profile:null,news:[],calendar:[],filter:"All",source:"news",currentTab:"home",brief:"",applications:[]};
const safe=(value)=>String(value??"").slice(0,900);
const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
function tabFromLocation(){const requested=new URLSearchParams(location.search).get("tab")||"home";return views.has(requested)?requested:"home"}
function openTab(name,push=true){
 if(!views.has(name))name="home";
 state.currentTab=name;
 for(const section of views){$("view-"+section)?.classList.toggle("active",section===name)}
 document.querySelectorAll("[data-section]").forEach(node=>node.classList.toggle("active",node.dataset.section===name));
 if(push)history.replaceState({}, "",name==="home"?"/app/":"/app/?tab="+encodeURIComponent(name));
 closeMenu();scrollTo({top:0,behavior:"instant"});
 if(name==="mentorship")refreshApplication();
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
  withTimeout(c.from("profiles").select("full_name,email,is_admin,avatar_url").eq("id",user.id).maybeSingle(),6000,"Profile request timed out")
   .then(({data:profile,error:profileError})=>{if(!profileError&&profile){state.profile=profile;paintUser(user,profile)}}).catch(()=>{});
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
 const sel=$("scriptTopic");const old=sel.value;sel.replaceChildren();
 const first=create("option","","Select a sourced news headline");first.value="";sel.append(first);
 for(const item of state.news.slice(0,30)){
  const option=create("option","",safe(item.title).slice(0,95));option.value=item.id;sel.append(option);
 }
 if(old&&state.news.some(x=>x.id===old))sel.value=old;
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
function setupScriptForm(){
 document.querySelectorAll("[data-source]").forEach(btn=>btn.addEventListener("click",()=>{
  state.source=btn.dataset.source;
  document.querySelectorAll("[data-source]").forEach(x=>x.classList.toggle("selected",x===btn));
  $("scriptTopic").hidden=state.source!=="news";$("scriptTopic").required=state.source==="news";
  $("customTopic").hidden=state.source!=="topic";$("customTopic").required=state.source==="topic";
 }));
 $("scriptBuilderForm").addEventListener("submit",e=>{
  e.preventDefault();
  const item=state.news.find(x=>x.id===$("scriptTopic").value),custom=$("customTopic").value.trim();
  if(state.source==="news"&&!item){$("briefResult").hidden=false;$("briefText").textContent="Please select an available market headline first.";return}
  if(state.source==="topic"&&custom.length<3){$("briefResult").hidden=false;$("briefText").textContent="Enter your custom topic first.";return}
  const topic=state.source==="news"?item.title:custom,duration=document.querySelector('input[name="duration"]:checked')?.value||"30";
  const source=state.source==="news"?"Publisher: "+domainSource(item.original_url)+"\nOriginal source: "+hrefSafe(item.original_url):"User-supplied topic — no verified source attached";
  state.brief="VIDEO SCRIPT BRIEF\n\nTopic: "+topic+"\nDuration: "+duration+" seconds\nLanguage: "+$("scriptLanguage").value+"\nStyle: "+$("scriptTone").value+
   "\n\n"+source+"\n\nRequested structure:\n1. Attention-grabbing hook\n2. Clear context and sourced facts\n3. Educational market explanation\n4. Responsible closing / CTA"+
   "\n\nImportant: Verify all facts. Do not invent news, market figures or guaranteed outcomes.\n\nThis is a brief, not an AI-generated video script.";
  $("briefText").textContent=state.brief;$("briefResult").hidden=false;$("briefResult").scrollIntoView({behavior:"smooth",block:"nearest"});
 });
 $("copyBrief").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(state.brief);$("copyBrief").textContent="Copied ✓"}
  catch{$("copyBrief").textContent="Select and copy the text above"}
 });
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
  const tab=button.dataset.section;openTab(tab);
 }));
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
 addEventListener("popstate",()=>openTab(tabFromLocation(),false));
 $("logout").addEventListener("click",async()=>{
  setBusy("logout",true);try{await state.client.auth.signOut()}finally{location.replace("/")}
 });
}
setupNavigation();setupScriptForm();setupMentorship();setupTheme();start();
})();