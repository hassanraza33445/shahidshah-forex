/* Native S M Shahid Shah Admin — AI Studio permissions only.
 * Admin identity is checked in Supabase RLS AND again by the Edge Function.
 * Never trusts role data provided by the browser for writes.
 */
(() => {"use strict";
 const PAGE_SIZE=50;
 const S={mounted:false,loading:false,actionBusy:false,records:[],access:new Map(),chosen:null,page:0,total:0,more:true,request:0,timer:null};
 const $=id=>document.getElementById(id);
 const admin=()=>typeof isLoggedIn!=="undefined"&&isLoggedIn===true&&
   typeof currentAdmin!=="undefined"&&currentAdmin?.is_admin===true&&
   typeof sb!=="undefined"&&sb!==null;
 const client=()=>typeof sb==="undefined"?null:sb;
 const nameOf=x=>String(x?.full_name||"").trim()||String(x?.email||"").split("@")[0]||"User";
 const initials=x=>nameOf(x).split(/\s+/).slice(0,2).map(y=>y[0]||"").join("").toUpperCase();
 const fmt=x=>{if(!x)return "Not recorded";let d=new Date(x);return Number.isNaN(d.getTime())?"Not recorded":new Intl.DateTimeFormat("en-MY",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d)};
 const node=(tag,cls,txt)=>{let el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=String(txt);return el};
 const status=(message,kind="")=>{const el=$("saActionStatus");if(el){el.textContent=message;el.className="sa-status "+(kind||"")}};
 function pill(kind,text){return node("span","sa-pill "+kind,text)}
 function flag(user){
  if(user.is_admin)return ["admin","Platform Admin"];
  const access=S.access.get(user.id);
  if(!access)return ["","Not assigned"];
  if(!access.enabled)return ["off","Removed"];
  return ["on","Active"];
 }
 function role(user){return user.is_admin?"Owner Admin":S.access.get(user.id)?.role||"—"}
 function renderList(){
  const body=$("saUsersBody");if(!body)return;
  body.replaceChildren();
  const filter=$("saFilter").value;
  let rows=S.records.filter(u=>{const a=S.access.get(u.id);return filter==="all"||(
   filter==="active"?(u.is_admin||a?.enabled===true):
   filter==="removed"?(a?.enabled===false&&!u.is_admin):
   filter==="none"?(!a&&!u.is_admin):
   filter==="admin"?u.is_admin:false)});
  for(const user of rows){
   const tr=node("tr",S.chosen?.id===user.id?"sa-selected":"");
   tr.tabIndex=0;tr.setAttribute("aria-label","Manage "+nameOf(user));
   const person=node("td"),personWrap=node("div","sa-person"),avatar=node("span","sa-avatar",initials(user));
   const details=node("span");details.append(node("b","",nameOf(user)),node("small","",user.email||"No email"));
   personWrap.append(avatar,details);person.append(personWrap);
   const r=node("td");r.append(pill(user.is_admin?"admin":"",role(user)));
   const [style,label]=flag(user);const st=node("td");st.append(pill(style,label));
   tr.append(person,r,st);
   tr.addEventListener("click",()=>selectUser(user));
   tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectUser(user)}});
   body.append(tr);
  }
  if(!rows.length){
   const tr=node("tr"),td=node("td","sa-empty",S.loading?"Loading users…":S.records.length?"No users match this filter on the loaded page. Try another filter or Load more.":"No registered users found.");
   td.colSpan=3;tr.append(td);body.append(tr);
  }
  $("saLoadedCount").textContent=S.records.length+" loaded";
  $("saPageInfo").textContent=S.records.length+" of "+S.total+" matching registered accounts";
  $("saMore").disabled=S.loading||!S.more;
  $("saMore").hidden=!S.more;
  $("saDirectoryStatus").textContent=S.loading?"Loading registered users…":S.records.length+" users loaded · Access granted only by admin";
 }
 function selectUser(user){
  S.chosen=user;
  const a=S.access.get(user.id),protectedAdmin=user.is_admin===true;
  $("saSelectedName").textContent=nameOf(user);
  $("saSelectedEmail").textContent=user.email||"No registered email";
  $("saSelectedAvatar").textContent=initials(user);
  const [kind,label]=flag(user);const tag=$("saCurrentTag");tag.className="sa-pill "+kind;tag.textContent=label;
  const el=$("saRole");el.value=["creator","viewer","editor","approver"].includes(a?.role)?a.role:"creator";
  el.disabled=S.actionBusy||protectedAdmin||!user.email;
  $("saGrant").disabled=el.disabled;
  $("saRevoke").disabled=S.actionBusy||protectedAdmin||a?.enabled!==true||!user.email;
  $("saResend").disabled=S.actionBusy||protectedAdmin||a?.enabled!==true||!user.email;
  status(protectedAdmin?"Platform admins are protected and remain authorized by their Admin profile.":
   a?.enabled?"This user currently has "+a.role+" access. You may change the role or remove access.":
   a?"Previous access was removed. You may grant it again.":"Select a role and Grant Access to enable this user.");
  renderList();
 }
 async function metrics(){
  if(!admin())return;
  const c=client();
  const reads=[
   c.from("profiles").select("id",{count:"exact",head:true}),
   c.from("content_access").select("user_id",{count:"exact",head:true}).eq("enabled",true),
   c.from("content_access").select("user_id",{count:"exact",head:true}).eq("enabled",false),
   c.from("profiles").select("id",{count:"exact",head:true}).eq("is_admin",true)
  ];
  const rs=await Promise.all(reads);
  for(const [i,id] of ["saTotalUsers","saActiveCount","saRemovedCount","saAdminCount"].entries())
   $(id).textContent=rs[i].error?"—":String(rs[i].count??0);
 }
 async function fetchPage(reset=false){
  if(!admin()||S.loading)return;
  if(reset){S.records=[];S.access.clear();S.page=0;S.more=true}
  S.loading=true;renderList();
  try{
   const c=client(),page=S.page,term=$("saSearch").value.trim().replace(/[^a-zA-Z0-9@._+\-\s]/g,"").slice(0,70);
   let q=c.from("profiles").select("id,email,full_name,is_admin,created_at",{count:"exact"}).order("created_at",{ascending:false});
   if(term)q=q.or("email.ilike.%"+term+"%,full_name.ilike.%"+term+"%");
   const {data:people,error,count}=await q.range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
   if(error)throw error;
   const list=people||[];
   if(list.length){
    const ids=list.map(u=>u.id);
    const {data:roles,error:roleErr}=await c.from("content_access")
      .select("user_id,role,enabled,granted_at,granted_by").in("user_id",ids);
    if(roleErr)throw roleErr;
    for(const entry of roles||[])S.access.set(entry.user_id,entry);
   }
   S.records.push(...list);S.total=count??S.records.length;S.page=page+1;
   S.more=S.records.length<S.total&&list.length===PAGE_SIZE;
   const selected=S.records.find(x=>x.id===S.chosen?.id);
   if(selected)S.chosen=selected;
   $("saDirectoryStatus").textContent="Directory ready";
  }catch(err){$("saDirectoryStatus").textContent="Could not load users: "+(err?.message||"Try Refresh");S.more=false}
  finally{S.loading=false;renderList();if(S.chosen)selectUser(S.chosen)}
 }
 async function history(){
  if(!admin())return;
  const container=$("saAuditList");container.replaceChildren();
  container.append(node("li","","Loading recent access activity…"));
  try{
   const {data,error}=await client().from("content_access_notifications")
    .select("id,user_id,acted_by,role,action,delivery_status,created_at").order("created_at",{ascending:false}).limit(12);
   if(error)throw error;container.replaceChildren();
   const rows=data||[],ids=[...new Set(rows.flatMap(r=>[r.user_id,r.acted_by]).filter(Boolean))];
   let names=new Map(S.records.map(r=>[r.id,r]));
   if(ids.length){
    const look=await client().from("profiles").select("id,email,full_name").in("id",ids);
    if(!look.error)for(const u of look.data||[])names.set(u.id,u);
   }
   for(const entry of rows){
    const li=node("li"),ic=node("span","sa-history-icon",entry.action==="revoked"?"−":entry.action==="resent"?"↗":"✓");
    const text=node("div");
    const target=names.get(entry.user_id),actor=names.get(entry.acted_by);
    text.append(node("b","",(entry.action==="revoked"?"Access removed":entry.action==="resent"?"Email resent":"Access granted")+" · "+nameOf(target)));
    text.append(node("p","",String(entry.role||"").toUpperCase()+" · "+fmt(entry.created_at)+" · By "+nameOf(actor)+" · Email: "+(entry.delivery_status||"unknown")));
    li.append(ic,text);container.append(li);
   }
   if(!rows.length)container.append(node("li","sa-empty","No access changes recorded yet."));
  }catch(err){container.replaceChildren(node("li","sa-empty","Activity unavailable: "+(err?.message||"Please retry")))}
 }
 async function action(type){
  if(!admin()||S.actionBusy||!S.chosen||S.chosen.is_admin)return;
  const target=S.chosen,access=S.access.get(target.id),role=$("saRole").value;
  if(!target.email)return status("Select a user with a registered email.","bad");
  if(type!=="grant"&&access?.enabled!==true)return status("This account does not currently have active Studio access.","bad");
  if(type==="revoke"&&!window.confirm("Remove AI Studio access for "+target.email+"? Their saved scripts will be retained."))return;
  S.actionBusy=true;selectUser(target);status((type==="grant"?"Saving role":type==="revoke"?"Removing access":"Resending email")+"…");
  try{
   const {data,error}=await client().functions.invoke("shahid-studio-access",{body:{action:type,email:target.email,role}});
   if(error||!data?.success)throw Error(data?.error||error?.message||"Permission request failed");
   if(type==="grant")S.access.set(target.id,{user_id:target.id,role,enabled:true});
   if(type==="revoke")S.access.set(target.id,{user_id:target.id,role:access?.role||"viewer",enabled:false});
   const email=data.email_status==="submitted"?"submitted to SMTP provider (delivery not guaranteed)":data.email_status==="skipped"?"not sent (SMTP unavailable)":data.email_status==="failed"?"failed":data.email_status||"unknown";
   status((type==="grant"?"Access enabled":type==="revoke"?"Access removed":"Email resent request completed")+". Email: "+email+(data.email_error?" · "+data.email_error:""),data.email_status==="failed"?"bad":"good");
   await Promise.all([metrics(),history()]);
  }catch(err){status(err?.message||"Permission change failed. Please retry.","bad")}
  finally{
   const message=$("saActionStatus").textContent;
   const kind=$("saActionStatus").classList.contains("bad")?"bad":$("saActionStatus").classList.contains("good")?"good":"";
   S.actionBusy=false;selectUser(target);
   status(message,kind);
  }
 }
 let searchTimer=null;
 async function mount(){
  if(S.mounted)return;
  const root=$("saRoot");
  if(!root)return;
  const res=await fetch("/assets/sm-admin-studio-access.html?v=20261117-admin-v1",{cache:"no-store"});
  if(!res.ok)throw Error("Admin page template not available");
  root.innerHTML=await res.text(); // Trusted, first-party static HTML only. Never user input.
  S.mounted=true;
  $("saRefresh").addEventListener("click",()=>reload());
  $("saAuditRefresh").addEventListener("click",history);
  $("saFilter").addEventListener("change",renderList);
  $("saSearch").addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>fetchPage(true),350)});
  $("saMore").addEventListener("click",()=>fetchPage());
  $("saGrant").addEventListener("click",()=>action("grant"));
  $("saRevoke").addEventListener("click",()=>action("revoke"));
  $("saResend").addEventListener("click",()=>action("resend"));
 }
 async function reload(){
  if(!admin())return;
  await Promise.all([fetchPage(true),metrics(),history()]);
 }
 async function load(){
  if(!admin())return;
  try{await mount();await reload()}catch(err){const root=$("saRoot");if(root)root.textContent="Studio Access unavailable: "+(err?.message||"Please refresh")}
 }
 window.SMStudioAccessAdmin={load};
})();