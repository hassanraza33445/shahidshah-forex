/* Premium admin command center — read-only, backed by live Supabase.
   This script never writes, deletes or migrates any client/user data. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id);
 const fmt=new Intl.NumberFormat("en-US");
 let fetching=false,ready=false;
 function authorized(){
  return typeof isLoggedIn!=="undefined" && isLoggedIn===true &&
   typeof currentAdmin!=="undefined" && currentAdmin?.is_admin===true &&
   typeof sb!=="undefined" && !!sb;
 }
 function change(id,value){const el=$(id);if(el)el.textContent=value}
 function humanNum(n){return Number.isFinite(Number(n))?fmt.format(Number(n)):"—"}
 function relativeTime(value){
  const stamp=Date.parse(value||"");if(!Number.isFinite(stamp))return "Time unavailable";
  const minutes=Math.max(0,Math.floor((Date.now()-stamp)/60000));
  if(minutes<1)return "Just now";
  if(minutes<60)return minutes+"m ago";
  if(minutes<1440)return Math.floor(minutes/60)+"h ago";
  if(minutes<10080)return Math.floor(minutes/1440)+"d ago";
  return new Date(stamp).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
 }
 function initials(name){return (String(name||"U").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("")||"U").toUpperCase().slice(0,2)}
 function normalizeEmail(e){return String(e||"").trim().toLowerCase()}
 function normalizePhone(p){const v=String(p||"").replace(/\D/g,"");return v.length>=7?v:""}
 // Union identical email and phone across sources without summing duplicate
 // registrations. Unknown contacts count as a distinct row, never discarded.
 function distinctPeople(rows){
  const parent=rows.map((_,i)=>i),rank=rows.map(()=>0),emails=new Map(),phones=new Map();
  const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  const union=(a,b)=>{a=find(a);b=find(b);if(a===b)return;if(rank[a]<rank[b])[a,b]=[b,a];parent[b]=a;if(rank[a]===rank[b])rank[a]++};
  rows.forEach((row,i)=>{
   const email=normalizeEmail(row.email),phone=normalizePhone(row.whatsapp||row.phone);
   if(email){if(emails.has(email))union(i,emails.get(email));else emails.set(email,i)}
   if(phone){if(phones.has(phone))union(i,phones.get(phone));else phones.set(phone,i)}
  });
  return new Set(rows.map((_,i)=>find(i))).size;
 }
 const sourceLabels={profile:"Account",webinar:"Webinar",prompt:"Prompt Tool",expo:"Expo"};
 function renderRecentPeople(rows){
  const list=$("smpRecentUsers");if(!list)return;list.replaceChildren();
  const unique=new Set(),people=[];
  for(const item of [...rows].sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")))){
   const email=normalizeEmail(item.email),phone=normalizePhone(item.whatsapp||item.phone);
   const key=email||phone||item.source+item.id;
   if(unique.has(key))continue;unique.add(key);people.push(item);if(people.length>=5)break;
  }
  if(!people.length){const el=document.createElement("p");el.className="smp-empty";el.textContent="No recent contacts found.";list.appendChild(el);return}
  for(const person of people){
   const row=document.createElement("div");row.className="smp-activity-item";
   const avatar=document.createElement("span");avatar.className="smp-avatar";avatar.textContent=initials(person.full_name||person.name||person.email);
   const content=document.createElement("span");content.className="smp-activity-content";
   const title=document.createElement("div");title.className="smp-activity-name";title.textContent=person.full_name||person.name||person.email||"New contact";
   const details=document.createElement("div");details.className="smp-activity-sub";
   details.textContent=(sourceLabels[person.source]||"User")+" • "+relativeTime(person.created_at);
   content.append(title,details);row.append(avatar,content);list.appendChild(row);
  }
 }
 function renderNews(items){
  const list=$("smpNewsList");if(!list)return;list.replaceChildren();
  if(!items?.length){const el=document.createElement("p");el.className="smp-empty";el.textContent="No published market headlines are available.";list.appendChild(el);return}
  for(const news of items){
   const row=document.createElement("div");row.className="smp-feed-item";
   const mark=document.createElement("i");mark.className="smp-feed-mark";mark.setAttribute("aria-hidden","true");
   const core=document.createElement("div");
   const title=document.createElement("div");title.className="smp-feed-title";title.textContent=news.title||"Untitled market news";
   const meta=document.createElement("div");meta.className="smp-feed-meta";
   const tag=document.createElement("span");tag.className="smp-tag";tag.textContent=news.category||"Market News";
   const txt=document.createElement("span");txt.textContent="Verified source link available in World News Hub";
   meta.append(tag,txt);core.append(title,meta);
   const stamp=document.createElement("span");stamp.className="smp-feed-time";stamp.textContent=relativeTime(news.published_at||news.first_seen_at);
   row.append(mark,core,stamp);list.appendChild(row);
  }
 }
 function renderProjects(items){
  const list=$("smpProjectsList");if(!list)return;list.replaceChildren();
  if(!items?.length){const el=document.createElement("p");el.className="smp-empty";el.textContent="No AI Studio scripts created yet.";list.appendChild(el);return}
  for(const script of items.slice(0,4)){
   const row=document.createElement("div");row.className="smp-operation";
   const left=document.createElement("div");
   const name=document.createElement("div");name.className="smp-operation-label";name.textContent=script.title||"Untitled project";
   const hint=document.createElement("div");hint.className="smp-operation-sub";hint.textContent=relativeTime(script.created_at);
   left.append(name,hint);
   const status=document.createElement("span");status.className="smp-operation-value smp-warn";status.textContent=String(script.status||"Draft").replace(/_/g," ");
   row.append(left,status);list.appendChild(row);
  }
 }
 function status(id,message,klass=""){
  const el=$(id);if(!el)return;el.textContent=message;el.className="smp-operation-value "+klass;
 }
 async function query(name,builder){
  const {data,count,error}=await builder;
  if(error)throw Error(name+": "+error.message);
  return {data:data||[],count};
 }
 function nav(page){
  if(!authorized())return;
  if(typeof showPage!=="function")return;
  const target=document.querySelector('.menu-item[data-page="'+page+'"]');
  if(target)showPage(page,target);
 }
 async function refresh(){
  if(fetching||!authorized())return;
  fetching=true;change("smpRefreshed","Updating live data…");
  const btn=$("smpRefresh");if(btn)btn.disabled=true;
  try{
   const jobs={
    profiles:()=>query("Accounts",sb.from("profiles").select("id,full_name,email,phone,created_at").limit(1000)),
    webinar:()=>query("Webinar clients",sb.from("webinar_registrations").select("id,name,email,whatsapp,created_at").limit(1000)),
    prompt:()=>query("Prompt Tool clients",sb.from("ai_tool_access_leads").select("id,name,email,whatsapp,created_at").limit(1000)),
    expo:()=>query("Expo clients",sb.from("expo_clients").select("id,name,email,whatsapp,created_at").limit(1000)),
    newsCount:()=>query("News count",sb.from("news_articles").select("id",{count:"exact",head:true}).eq("is_visible",true)),
    news:()=>query("Recent news",sb.from("news_articles").select("title,category,published_at,first_seen_at").eq("is_visible",true).order("published_at",{ascending:false}).limit(6)),
    sources:()=>query("News sources",sb.from("news_sources").select("id,last_error,last_success_at,enabled").eq("enabled",true).limit(1000)),
    projectCount:()=>query("Studio project count",sb.from("content_projects").select("id",{count:"exact",head:true})),
    projects:()=>query("Studio projects",sb.from("content_projects").select("id,title,status,created_at").order("created_at",{ascending:false}).limit(4)),
    notices:()=>query("Active notification events",sb.from("market_notification_events").select("id,title,topic,created_at").eq("is_active",true).order("created_at",{ascending:false}).limit(1))
   };
   const names=Object.keys(jobs);
   const results=await Promise.allSettled(names.map(n=>jobs[n]()));
   const good={};const failures=[];
   results.forEach((result,i)=>{if(result.status==="fulfilled")good[names[i]]=result.value;else failures.push(names[i])});
   const inputs=["profiles","webinar","prompt","expo"];
   if(inputs.every(k=>good[k])){
    const rows=inputs.flatMap(source=>good[source].data.map(item=>({...item,source})));
    change("smpUsers",humanNum(distinctPeople(rows)));
    change("smpUsersDetail","Unique accounts and contacts · no duplicate emails/phones");
    renderRecentPeople(rows);
    change("sidebarUsersCount",humanNum(good.profiles.data.length));
   }else{
    change("smpUsers","—");
    change("smpUsersDetail","Some contact sources could not be loaded");
    change("smpRecentUsers","Access to some client records is unavailable.");
   }
   if(good.newsCount){change("smpNewsCount",humanNum(good.newsCount.count||0));change("smpNewsDetail","Currently visible articles");}
   else{change("smpNewsCount","—");change("smpNewsDetail","News count unavailable");}
   if(good.news)renderNews(good.news.data);
   else change("smpNewsList","News headlines are temporarily unavailable.");
   if(good.projectCount){change("smpStudioCount",humanNum(good.projectCount.count||0));change("smpStudioDetail","Scripts and projects saved in AI Studio");}
   else{change("smpStudioCount","—");change("smpStudioDetail","Studio count unavailable");}
   if(good.projects)renderProjects(good.projects.data);
   else change("smpProjectsList","AI Studio records unavailable.");
   if(good.sources){
    const feeds=good.sources.data,active=feeds.length;
    const errors=feeds.filter(x=>x.last_error).length;
    const success=feeds.filter(x=>x.last_success_at&&!x.last_error).length;
    change("smpSources",humanNum(active));
    change("smpSourcesDetail",active+" configured active RSS feeds");
    status("smpSourceHealth",errors?errors+" need attention":"Healthy",errors?"smp-warn":"smp-good");
    change("smpSourceDetail",success+"/"+active+" previously polled successfully");
   }else{
    change("smpSources","—");change("smpSourcesDetail","Feed registry unavailable");
    status("smpSourceHealth","Unknown","smp-warn");change("smpSourceDetail","Feed status unavailable");
   }
   if(good.notices){
    const latest=good.notices.data[0];
    status("smpAlertStatus",latest?"Active notices":"No active notices",latest?"smp-good":"smp-warn");
    change("smpAlertDetail",latest?"Latest notice "+relativeTime(latest.created_at):"No currently active market notification events");
   }else{status("smpAlertStatus","Unavailable","smp-warn");change("smpAlertDetail","Notification feed status could not be loaded");}
   const email=typeof currentAdmin==="object"&&currentAdmin?.email?String(currentAdmin.email):"Authorized Admin";
   change("smpCurrentAdmin",email);
   const nameHolder=document.querySelector(".admin-info h3");
   if(nameHolder)nameHolder.textContent=email.split("@")[0]||"Admin";
   const roleHolder=document.querySelector(".admin-info p");if(roleHolder)roleHolder.textContent="Platform Administrator";
   const avatar=document.querySelector(".admin-avatar");if(avatar)avatar.textContent=initials(email.split("@")[0]);
   change("smpRefreshed",failures.length?"Some sections could not load. Refresh to retry.":"Updated "+new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kuala_Lumpur"})+" MYT");
   ready=true;
  }catch(e){
   console.error("Admin dashboard",e);
   change("smpRefreshed","Unable to refresh dashboard. Try again.");
  }finally{fetching=false;if(btn)btn.disabled=false}
 }
 window.SMAdminPremium={refresh,nav};
 document.addEventListener("DOMContentLoaded",()=>{
  $("smpRefresh")?.addEventListener("click",()=>void refresh());
  $("smpGlobalSearch")?.addEventListener("keydown",event=>{
    if(event.key!=="Enter")return;
    event.preventDefault();
    const query=event.currentTarget.value.trim();
    nav("leads");
    const search=$("unifiedLeadSearch");
    if(search){search.value=query;search.dispatchEvent(new Event("input",{bubbles:true}));}
  });
  document.querySelectorAll("[data-smp-open]").forEach(button=>button.addEventListener("click",()=>nav(button.dataset.smpOpen)));
 });
})();
