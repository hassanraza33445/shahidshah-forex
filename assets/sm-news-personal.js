/* Market Intelligence Phase 3 — account-owned reading list, watchlists and in-app preferences.
   Uses existing Supabase auth and RLS; no keys except the public publishable key. */
(()=>{"use strict";
const BASE="https://qggtdwixwafcmorepkks.supabase.co";
const KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const TOPICS=["Gold","Forex","Crypto","Central Banks","Economic Data","Energy","Geopolitics"];
const $=(t,cls,text)=>{const n=document.createElement(t);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const state={client:null,user:null,ready:false,init:false,loading:null,saved:new Map(),watch:[],prefs:null,inbox:[],dialog:null,tab:"saved",toolbar:null,status:null,body:null};
const badge=(t)=>$("span","sm-personal-muted",t);
function setStatus(text,error=false){if(state.status){state.status.textContent=text;state.status.dataset.error=String(error)}const tip=document.getElementById("smNewsPersonalCount");if(tip)tip.textContent=text||state.saved.size+" saved • "+state.watch.length+" watchwords"}
function addButton(parent,label,onClick){const b=$("button","",label);b.type="button";b.addEventListener("click",onClick);parent.append(b);return b}
function loginHref(){return "/auth/?next="+encodeURIComponent(location.pathname+location.search)}
function ensureLogin(){if(state.user)return true;setStatus("Sign in to save articles and settings.",true);if(state.body)state.body.replaceChildren(badge("Please sign in to use your private news list."));return false}
async function fetchSaved(){
 const {data,error}=await state.client.from("news_saved_articles").select("article_id,created_at").order("created_at",{ascending:false}).limit(200);
 if(error)throw error;
 state.saved=new Map((data||[]).map(v=>[v.article_id,v.created_at]));
}
async function fetchWatch(){
 const {data,error}=await state.client.from("news_keyword_watchlists").select("id,keyword,category,enabled,created_at").order("created_at",{ascending:false}).limit(100);
 if(error)throw error;state.watch=data||[];
}
async function fetchPrefs(){
 const {data,error}=await state.client.from("market_notification_preferences").select("user_id,in_app_enabled,breaking_enabled,economic_enabled,keyword_alerts_enabled,push_enabled,topics,timezone").eq("user_id",state.user.id).maybeSingle();
 if(error)throw error;state.prefs=data;
}
async function loadPrivate(){
 if(!state.user)return;
 if(state.loading)return state.loading;
 state.loading=Promise.all([fetchSaved(),fetchWatch(),fetchPrefs()]).then(()=>{
   state.ready=true;setStatus("");syncSaves();renderCurrent();
 }).catch(e=>{state.ready=false;setStatus("Unable to load account settings. Try refreshing.",true);console.warn("Private News settings unavailable",e)}).finally(()=>{state.loading=null});
 return state.loading;
}
function savedLabel(id){return state.saved.has(id)?"★ Saved":"☆ Save"}
function syncSaves(){
 document.querySelectorAll("article[data-news-article-id]").forEach(card=>{
  const id=card.dataset.newsArticleId||"";if(!id)return;
  const actions=card.querySelector(".push");if(!actions)return;
  let b=actions.querySelector(".sm-news-save");
  if(!b){b=$("button","sm-news-save");b.type="button";b.dataset.articleId=id;
    b.addEventListener("click",()=>toggleSaved(id,b));actions.append(b)}
  b.disabled=!state.ready;
  b.textContent=savedLabel(id);
  b.setAttribute("aria-pressed",String(state.saved.has(id)));
  b.setAttribute("aria-label",state.saved.has(id)?"Remove from saved articles":"Save article to reading list");
 });
}
async function toggleSaved(id,button){
 if(!ensureLogin()||!state.ready||!id)return;
 if(button)button.disabled=true;
 const exists=state.saved.has(id);
 try{
  const q=exists?state.client.from("news_saved_articles").delete().eq("user_id",state.user.id).eq("article_id",id):
    state.client.from("news_saved_articles").insert({user_id:state.user.id,article_id:id});
  const {error}=await q;if(error)throw error;
  if(exists)state.saved.delete(id);else state.saved.set(id,new Date().toISOString());
  syncSaves();renderCurrent();setStatus(exists?"Removed from saved news.":"Article saved.");
 }catch(e){setStatus("Could not update saved news. Please retry.",true);console.warn("Save article failed",e)}
 finally{if(button)button.disabled=false}
}
function drawDialog(){
 if(state.dialog)return;
 const dialog=$("dialog","sm-personal-dialog");dialog.id="smNewsPersonalDialog";
 dialog.setAttribute("aria-label","Personal news tools");
 const head=$("div","sm-personal-head"),titles=$("div");
 titles.append($("h2","","My News Workspace"),$("p","","Private reading list, keyword watchlists and in-app alerts"));
 const close=addButton(head,"×",()=>dialog.close());close.className="sm-personal-close";close.setAttribute("aria-label","Close news workspace");
 head.prepend(titles);dialog.append(head);
 const nav=$("div","sm-personal-tabs");nav.setAttribute("role","tablist");
 for(const [tab,label] of [["saved","Saved Articles"],["watch","Watchlist"],["prefs","Alerts"],["inbox","Inbox"]]){
  const b=addButton(nav,label,()=>{state.tab=tab;renderCurrent()});b.dataset.tab=tab;b.setAttribute("role","tab");
 }
 dialog.append(nav);state.body=$("section","sm-personal-content");dialog.append(state.body);
 state.status=$("p","sm-personal-status");state.status.setAttribute("role","status");state.status.setAttribute("aria-live","polite");dialog.append(state.status);
 document.body.append(dialog);state.dialog=dialog;
}
function rowItem(title,sub){
 const card=$("article","sm-personal-card");
 card.append($("h3","",title),$("small","",sub||""));
 const actions=$("div","sm-personal-actions");card.append(actions);
 return {card,actions};
}
async function renderSaved(){
 const saved=Array.from(state.saved.keys()).slice(0,150);
 if(!saved.length){state.body.append(badge("No saved articles yet. Use ☆ Save on any headline."));return}
 state.body.append(badge(saved.length+" saved articles. Only your account can access this list."));
 const {data,error}=await state.client.from("news_articles")
   .select("id,title,summary,publisher,original_url,published_at,category,priority,priority_reason,verification_status")
   .in("id",saved);
 if(error){state.body.append(badge("Could not load your saved article details."));return}
 if(state.tab!=="saved")return;
 const lookup=new Map((data||[]).map(a=>[a.id,a]));
 for(const id of saved){const a=lookup.get(id);if(!a)continue;
  const d=new Date(a.published_at);
  const {card,actions}=rowItem(a.title,(a.publisher||"Publisher")+" • "+(Number.isFinite(d.getTime())?d.toLocaleDateString():"Date unknown"));
  addButton(actions,"Read details",()=>window.SMNewsReader?.open(a));
  addButton(actions,"Remove",()=>toggleSaved(id));
  const url=safeLink(a.original_url);if(url){const link=$("a","","Original source");link.href=url;link.target="_blank";link.rel="noopener noreferrer";actions.append(link)}
  state.body.append(card);
 }
}
function safeLink(s){try{const u=new URL(String(s||""));return u.protocol==="https:"||u.protocol==="http:"?u.href:null}catch{return null}}
function searchWord(row){
 const q=document.getElementById("query"),c=document.getElementById("category"),form=document.getElementById("filterForm");
 if(!q||!c||!form)return;
 q.value=row.keyword;c.value=row.category||"All";
 form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));state.dialog?.close();
}
async function addWatch(word,category){
 if(!ensureLogin()||!state.ready)return;
 word=word.trim().replace(/\s+/g," ");
 if(word.length<2||word.length>70){setStatus("Use a keyword between 2 and 70 characters.",true);return}
 if(state.watch.length>=40){setStatus("Maximum 40 watchlist keywords per account.",true);return}
 if(category&&!TOPICS.includes(category)){setStatus("Invalid category.",true);return}
 try{
  const {error}=await state.client.from("news_keyword_watchlists").insert({user_id:state.user.id,keyword:word,category:category||null});
  if(error)throw error;
  await fetchWatch();renderCurrent();setStatus("Watchlist keyword added.");
 }catch(e){setStatus(e.code==="23505"?"This keyword is already on your watchlist.":"Could not add keyword.",true)}
}
async function modifyWatch(row,action){
 if(!ensureLogin()||!state.ready)return;
 try{
  const q=state.client.from("news_keyword_watchlists");
  const {error}=action==="delete"?await q.delete().eq("id",row.id).eq("user_id",state.user.id):
    await q.update({enabled:!row.enabled}).eq("id",row.id).eq("user_id",state.user.id);
  if(error)throw error;
  await fetchWatch();renderCurrent();setStatus("Watchlist updated.");
 }catch(e){setStatus("Could not update watchlist.",true)}
}
function renderWatch(){
 const form=$("form","sm-personal-form");form.noValidate=true;
 const line=$("div","sm-personal-form-row");
 const a=$("label","","Keyword"),input=$("input");input.maxLength=70;input.required=true;input.placeholder="e.g. XAUUSD, CPI, FOMC";a.append(input);
 const b=$("label","","Category"),sel=$("select");
 for(const opt of [["","All categories"],...TOPICS.map(x=>[x,x])]){const o=$("option","",opt[1]);o.value=opt[0];sel.append(o)}
 b.append(sel);line.append(a,b);
 const submit=$("button","","Add");submit.type="submit";line.append(submit);form.append(line);
 form.addEventListener("submit",e=>{e.preventDefault();addWatch(input.value,sel.value)});
 state.body.append(form,badge("Enable Keyword HOT Alerts under Alerts to receive matching headlines in your private inbox. Browser push needs separate permission."));
 for(const item of state.watch){
  const {card,actions}=rowItem(item.keyword,(item.category||"All categories")+" • "+(item.enabled?"Active":"Paused"));
  addButton(actions,"Search headlines",()=>searchWord(item));
  addButton(actions,item.enabled?"Pause":"Resume",()=>modifyWatch(item,"toggle"));
  addButton(actions,"Remove",()=>modifyWatch(item,"delete"));
  state.body.append(card);
 }
 if(!state.watch.length)state.body.append(badge("Your keyword watchlist is empty."));
}
function optionCheck(parent,label,checked,field,value){
 const lab=$("label","sm-personal-switch");
 const cb=$("input");cb.type="checkbox";cb.checked=checked;cb.dataset.field=field;if(value)cb.value=value;
 lab.append(cb,document.createTextNode(label));parent.append(lab);return cb;
}

async function notificationAPI(mode,body){
 const {data:{session},error:sessionError}=await state.client.auth.getSession();
 if(sessionError||!session?.access_token)throw new Error("Please sign in again.");
 const url=BASE+"/functions/v1/market-notifications-api"+(mode?"?mode="+encodeURIComponent(mode):"");
 const res=await fetch(url,{method:body?"POST":"GET",cache:"no-store",headers:{
  apikey:KEY,Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})
 },...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json().catch(()=>null);
 if(!res.ok||!data?.success)throw new Error(data?.error||"Notification service unavailable");
 return data;
}
async function renderInbox(){
 if(!state.user)return;
 const loading=badge("Loading your private notification inbox…");state.body.append(loading);
 const data=await notificationAPI("inbox");
 if(state.tab!=="inbox")return;
 state.inbox=data.items||[];
 state.body.replaceChildren(badge("Notifications are delivered only for topics you opted into. Unverified news is clearly labeled."));
 if(!state.inbox.length){state.body.append(badge("No alerts in your inbox yet. Enable your preferences and add watchlist keywords."));return}
 for(const n of state.inbox.slice(0,80)){
  const {card,actions}=rowItem(n.title,(n.read_at?"Read":"Unread")+" • "+(n.topic||"Market")+" • "+(n.trust_status||"unverified")+" • "+new Date(n.created_at).toLocaleString());
  if(n.body)card.insertBefore($("p","sm-personal-muted",n.body),actions);
  if(n.source_article_id){
   addButton(actions,"Read news",async()=>{
    const {data:item,error}=await state.client.from("news_articles")
     .select("id,title,summary,publisher,original_url,published_at,category,priority,priority_reason,verification_status")
     .eq("id",n.source_article_id).maybeSingle();
    if(error||!item){setStatus("Article is no longer available.",true);return}
    state.dialog?.close();window.SMNewsReader?.open(item);
   });
  }
  if(!n.read_at)addButton(actions,"Mark read",async()=>{
   try{await notificationAPI("",{action:"mark_read",id:n.id});renderInbox()}
   catch(e){setStatus("Could not mark alert as read.",true)}
  });
  state.body.append(card);
 }
}
let sdkPromise=null;
async function loadOneSignal(config){
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  window.OneSignalDeferred.push(async OneSignal=>{
   try{
    await OneSignal.init({appId:config.app_id,serviceWorkerPath:config.worker,
     serviceWorkerParam:{scope:"/onesignal/"},notifyButton:{enable:false},promptOptions:{autoPrompt:false}});
    resolve(OneSignal);
   }catch(e){reject(e)}
  });
  const script=$("script");script.src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  script.async=true;script.onerror=()=>reject(Error("Unable to load OneSignal SDK"));
  document.head.append(script);
 }).catch(e=>{sdkPromise=null;throw e});
 return sdkPromise;
}
async function renderPushControls(root,pref){
 const label=badge("Checking browser push configuration…");root.append(label);
 try{
  const res=await fetch(BASE+"/functions/v1/market-notifications-api?mode=push-config",{headers:{apikey:KEY},cache:"no-store"});
  const config=await res.json();if(!res.ok||!config.success)throw Error("Push status unavailable");
  label.textContent=config.configured?"OneSignal is available. Browser permission is always optional.":"OneSignal is not configured yet. Browser push remains OFF; in-app alerts work independently.";
  if(!config.configured)return;
  if(location.origin!==config.canonical_origin){
   const a=$("a","","Open official www website to manage browser push");
   a.href=config.canonical_origin+location.pathname+location.search;a.rel="noopener noreferrer";root.append(a);
   return;
  }
  if(!pref?.in_app_enabled||!(pref.breaking_enabled||pref.economic_enabled||pref.keyword_alerts_enabled)){
   root.append(badge("Save at least one enabled in-app alert preference before enabling browser push."));return;
  }
  const buttons=$("div","sm-personal-actions");root.append(buttons);
  if(pref.push_enabled){
   addButton(buttons,"Disable browser push",async()=>{
    try{
     await notificationAPI("",{action:"unregister_all_push_devices"});
     const sdk=await sdkPromise?.catch(()=>null);if(sdk)await sdk.User.PushSubscription.optOut();
     await fetchPrefs();renderCurrent();setStatus("Browser push disabled for your account.");
    }catch(e){setStatus("Unable to disable push. Please retry.",true)}
   });
   return;
  }
  const prepare=addButton(buttons,"Prepare browser push",async()=>{
   prepare.disabled=true;
   try{
    const sdk=await loadOneSignal(config);
    prepare.remove();
    addButton(buttons,"Allow browser notifications",async()=>{
     try{
      await sdk.Notifications.requestPermission();
      if(Notification.permission!=="granted")throw Error("Browser permission was not granted");
      await sdk.User.PushSubscription.optIn();
      const id=sdk.User.PushSubscription.id;
      if(!id)throw Error("No active OneSignal subscription ID was received");
      await notificationAPI("",{action:"register_push_device",subscription_id:id,browser_permission_granted:true});
      await fetchPrefs();renderCurrent();setStatus("Browser push registered for this device.");
     }catch(e){setStatus(e.message||"Browser notification registration failed.",true)}
    });
    setStatus("OneSignal ready. Permission is requested only when you click Allow.");
   }catch(e){setStatus(e.message||"OneSignal could not initialize.",true);prepare.disabled=false}
  });
 }catch(e){label.textContent="Browser push configuration could not be checked. In-app preferences remain available."}
}

function renderPrefs(){
 const form=$("form","sm-personal-form");const p=state.prefs;
 const inapp=optionCheck(form,"In-app notifications",p?.in_app_enabled===true,"in_app");
 const breaking=optionCheck(form,"Important HOT market news",p?.breaking_enabled===true,"breaking");
 const economic=optionCheck(form,"Confirmed economic calendar reminders",p?.economic_enabled===true,"economic");
 const keywords=optionCheck(form,"HOT news matching my enabled watchlist keywords",p?.keyword_alerts_enabled===true,"keywords");
 form.append(badge("Choose which news topics you want in your in-app notification inbox."));
 const topics=$("div","sm-personal-topics");const selected=Array.isArray(p?.topics)?p.topics:["Gold","Forex","Crypto","Central Banks","Economic Data"];
 for(const topic of TOPICS)optionCheck(topics,topic,selected.includes(topic),"topic",topic);form.append(topics);
 const submit=$("button","","Save preferences");submit.type="submit";form.append(submit);
 form.addEventListener("submit",async e=>{
  e.preventDefault();if(!ensureLogin()||!state.ready)return;
  const values={user_id:state.user.id,in_app_enabled:inapp.checked,breaking_enabled:breaking.checked,
   economic_enabled:economic.checked,keyword_alerts_enabled:keywords.checked,topics:Array.from(topics.querySelectorAll("input:checked")).map(x=>x.value)};
  submit.disabled=true;
  try{
   const {error}=await state.client.from("market_notification_preferences").upsert(values,{onConflict:"user_id"});
   if(error)throw error;await fetchPrefs();setStatus("In-app notification preferences saved.");
  }catch(e){setStatus("Unable to save preferences.",true);console.warn("Notification preference save failed",e)}
  finally{submit.disabled=false}
 });
 state.body.append(form,badge("Browser push is separate from in-app alerts. No browser permission is requested by saving these settings."));
 const pushArea=$("section","sm-personal-card");pushArea.append($("h3","","Browser Push (optional)"));
 state.body.append(pushArea);renderPushControls(pushArea,p).catch(()=>{});

}
function renderCurrent(){
 if(!state.dialog||!state.body)return;
 state.dialog.querySelectorAll("[data-tab]").forEach(x=>x.setAttribute("aria-selected",String(x.dataset.tab===state.tab)));
 state.body.replaceChildren();
 if(!state.user){state.body.append(badge("Please sign in to use personal news tools."));const a=$("a","","Sign in");a.href=loginHref();state.body.append(a);return}
 if(!state.ready){state.body.append(badge("Loading your private news preferences…"));return}
 if(state.tab==="saved"){renderSaved().catch(()=>setStatus("Could not display saved articles.",true))}
 else if(state.tab==="watch")renderWatch();
 else if(state.tab==="inbox")renderInbox().catch(()=>setStatus("Unable to load inbox.",true));
 else renderPrefs();
}
function open(tab){
 drawDialog();state.tab=tab;renderCurrent();
 if(!state.dialog.open)state.dialog.showModal();
 if(!state.ready&&state.user)loadPrivate();
}
function buildToolbar(){
 if(state.toolbar)return;
 const form=document.getElementById("filterForm");if(!form)return;
 const bar=$("div","sm-news-personal-tools");bar.setAttribute("aria-label","Personal news tools");
 for(const [tab,label] of [["saved","★ Saved Articles"],["watch","⌕ Watchlist"],["prefs","⚙ Alerts"]]){
  const b=addButton(bar,label,()=>open(tab));b.className="action";b.setAttribute("aria-haspopup","dialog");
 }
 const count=$("span","sm-news-personal-count");count.id="smNewsPersonalCount";bar.append(count);
 form.insertAdjacentElement("afterend",bar);state.toolbar=bar;setStatus("");syncSaves();
}
async function init(){
 if(state.init)return;state.init=true;
 if(!window.supabase?.createClient)return;
 state.client=window.supabase.createClient(BASE,KEY);
 buildToolbar();drawDialog();
 try{
  const {data,error}=await state.client.auth.getUser();if(error||!data?.user)throw error||new Error("Not signed in");
  state.user=data.user;await loadPrivate();
   // Deep-link from the member sidebar opens the requested private workspace tab.
   // Only recognized tabs are accepted; no authorization is inferred from the URL.
   const tab=new URLSearchParams(location.search).get("panel");
   if(["inbox","prefs","watch","saved"].includes(tab))open(tab);
 }catch(e){state.ready=false;setStatus("Sign in for personal news tools.",true);syncSaves()}
}
window.addEventListener("sm:news-displayed",syncSaves);
document.addEventListener("sm:member-verified",init);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{
 if(document.documentElement.classList.contains("sm-member-allowed"))init();
},{once:true});
else if(document.documentElement.classList.contains("sm-member-allowed"))init();
window.SMNewsPersonal={open,syncSaves};
})();