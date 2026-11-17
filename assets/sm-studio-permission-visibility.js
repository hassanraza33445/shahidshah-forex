/* Studio feature visibility. Every element is HIDDEN until an authenticated
 * account's admin / server-managed Studio role is verified against Supabase.
 * This is presentation only; RLS and Edge Functions independently enforce access.
 */
(()=>{"use strict";
 const URL="https://qggtdwixwafcmorepkks.supabase.co";
 const PUBLISHABLE="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
 const rights={studio:false,create:false};
 window.SMStudioRights=rights;
 let finished=false;
 function publish(studio,create){
  rights.studio=studio===true;rights.create=create===true;
  document.querySelectorAll("[data-sm-studio-access]").forEach(el=>{
   const needed=el.getAttribute("data-sm-studio-access");
   const yes=needed==="create"?rights.create:rights.studio;
   el.classList.toggle("sm-studio-authorized",yes);
   if(!yes&&el===document.activeElement)el.blur();
  });
  document.dispatchEvent(new CustomEvent("sm:studio-access",{detail:{...rights}}));
  finished=true;
 }
 async function sdk(){
  if(window.supabase?.createClient)return;
  let existing=document.querySelector("script[data-sm-studio-rights-sdk]");
  if(!existing){
   existing=document.createElement("script");
   existing.dataset.smStudioRightsSdk="1";
   existing.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
   existing.async=true;document.head.append(existing);
  }
  await new Promise((resolve,reject)=>{
   const start=Date.now();
   const check=()=>window.supabase?.createClient?resolve():Date.now()-start>8500?reject(Error("SDK unavailable")):setTimeout(check,120);
   check();
  });
 }
 async function check(){
  try{
   await sdk();
   const client=window.supabase.createClient(URL,PUBLISHABLE);
   const {data:{user},error}=await client.auth.getUser();
   if(error||!user){publish(false,false);return;}
   const [p,a]=await Promise.all([
    client.from("profiles").select("is_admin").eq("id",user.id).maybeSingle(),
    client.from("content_access").select("enabled,role").eq("user_id",user.id).maybeSingle()
   ]);
   // Permission errors fail closed (do not trust flags in localStorage or the URL).
   const admin=!p.error&&p.data?.is_admin===true;
   const role=!a.error&&a.data?.enabled===true?a.data.role:null;
   publish(admin||["viewer","creator","editor","approver","admin"].includes(role),
           admin||["creator","editor","approver","admin"].includes(role));
  }catch{publish(false,false)}
 }
 void check();
 document.addEventListener("visibilitychange",()=>{
  if(!document.hidden&&finished)void check();
 });
})();