// READ ONLY public API smoke audit. Never post actual registrations or send mail.
const root="https://www.smshahidshah.com";
const api="https://qggtdwixwafcmorepkks.supabase.co";
const publishable="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb"; // PUBLIC key, not secret.
const results=[];
async function fetchResult(label,url,init={},test=()=>true){
  let result={label,status:"ERROR",http:null,ms:null};
  const begin=Date.now();
  try{
    const response=await fetch(url,{...init,signal:AbortSignal.timeout(18000),redirect:"follow",cache:"no-store"});
    let text=await response.text();const type=response.headers.get("content-type")||"";
    let data=null;try{data=JSON.parse(text)}catch{}
    const detail=test(response,data,text,type);
    result={label,http:response.status,ms:Date.now()-begin,status:detail?.status||"PASS",detail:detail?.detail||""};
  }catch(e){result={label,status:"ERROR",detail:String(e).slice(0,160),ms:Date.now()-begin}}
  results.push(result);console.log("AUDIT "+JSON.stringify(result));
}
const tasks=[];
for(const path of ["/","/market-intelligence/","/content-studio/","/ai-video-scripts/","/about/","/videos/","/webinar-admin.html","/admin-panel.html"]){
 tasks.push(()=>fetchResult("page "+path,root+path,{},(r,d,t,ct)=>({status:r.status===200&&ct.includes("text/html")?"PASS":"FAIL",detail:"HTML page; "+ct.slice(0,36)})));
}
tasks.push(()=>fetchResult("news feed",api+"/functions/v1/market-intelligence-api?mode=feed&page=1&limit=24",{headers:{apikey:publishable}},(r,d,t,ct)=>({status:r.status===200&&d?.success===true&&Array.isArray(d?.items)&&d.items.length>0?"PASS":"FAIL",detail:JSON.stringify({items:d?.items?.length,duplicates:d?.items?.length-new Set((d?.items||[]).map(x=>x.original_url)).size,refresh:d?.last_refresh,serverError:d?.error||null})})));
tasks.push(()=>fetchResult("news stats",api+"/functions/v1/market-intelligence-api?mode=stats",{headers:{apikey:publishable}},(r,d)=>({status:r.status===200&&d?.success?"PASS":"FAIL",detail:JSON.stringify({articles:d?.articles,refresh:d?.last_refresh})})));
tasks.push(()=>fetchResult("news Gold filter",api+"/functions/v1/market-intelligence-api?mode=feed&category=Gold&limit=5",{headers:{apikey:publishable}},(r,d)=>({status:r.status===200&&d?.success&&Array.isArray(d?.items)?"PASS":"FAIL",detail:JSON.stringify({items:d?.items?.length,categories:[...new Set((d?.items||[]).map(i=>i.category))]})})));
tasks.push(()=>fetchResult("Gemini config presence",api+"/functions/v1/shahid-content-ai?health=1",{headers:{apikey:publishable}},(r,d)=>({status:r.status===200&&d?.gemini_configured===true?"PASS":"FAIL",detail:JSON.stringify({configured:d?.gemini_configured,groq:d?.groq_configured,model:d?.model})})));
tasks.push(()=>fetchResult("auth health",api+"/auth/v1/health",{headers:{apikey:publishable}},(r,d)=>({status:r.status===200?"PASS":"WARN",detail:"Auth service HTTP "+r.status})));
for(const fn of ["shahid-content-ai","shahid-studio-access","shahid-studio-transcribe"]){
 tasks.push(()=>fetchResult("block unauth "+fn,api+"/functions/v1/"+fn,{method:"POST",headers:{apikey:publishable,"Content-Type":"application/json"},body:"{}"},(r,d)=>({status:r.status===401||r.status===403?"PASS":"FAIL",detail:"Expected 401/403, response "+r.status+" "+String(d?.error||"").slice(0,60)})));
}
for(const fn of ["market-intelligence-api","shahid-content-ai","shahid-studio-access","shahid-studio-transcribe"]){
 tasks.push(()=>fetchResult("preflight "+fn,api+"/functions/v1/"+fn,{method:"OPTIONS",headers:{"Origin":root,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type,apikey,authorization"}},(r,d,t,ct)=>({status:r.status===204||r.status===200?"PASS":"FAIL",detail:"HTTP "+r.status+" CORS "+r.headers.get("access-control-allow-origin")})));
}
for(const fn of ["send-webinar-confirmation","bulk-webinar-reschedule"]){
 tasks.push(()=>fetchResult("protected legacy "+fn,api+"/functions/v1/"+fn,{method:"POST",headers:{"Content-Type":"application/json",apikey:publishable},body:"{}"},(r,d)=>({status:r.status===401||r.status===403?"PASS":(fn==="send-webinar-confirmation"&&r.status===400?"WARN":"FAIL"),detail:"Unauth HTTP "+r.status+(fn==="send-webinar-confirmation"?" - validation occurs before user authentication; review replay/abuse controls":"")})));
}
tasks.push(()=>fetchResult("webinar config RPC",api+"/rest/v1/rpc/get_webinar_public_config",{method:"POST",headers:{"Content-Type":"application/json",apikey:publishable},body:"{}"},(r,d)=>({status:r.status===200&&d&&typeof d==="object"?"PASS":"FAIL",detail:"HTTP "+r.status+" public config "+(d?"returned":"missing")})));
tasks.push(()=>fetchResult("anon profile isolation",api+"/rest/v1/profiles?select=id%2Cemail&limit=1",{headers:{apikey:publishable}},(r,d)=>({status:(r.status===200&&Array.isArray(d)&&d.length===0)||r.status===401||r.status===403?"PASS":"FAIL",detail:"HTTP "+r.status+" visible profile rows "+(Array.isArray(d)?d.length:"not available")})));
tasks.push(()=>fetchResult("anon studio data isolation",api+"/rest/v1/content_projects?select=id%2Ctitle&limit=1",{headers:{apikey:publishable}},(r,d)=>({status:(r.status===200&&Array.isArray(d)&&d.length===0)||r.status===401||r.status===403?"PASS":"FAIL",detail:"HTTP "+r.status+" visible projects "+(Array.isArray(d)?d.length:"not available")})));
const workers=Array.from({length:4},async()=>{
 while(tasks.length) await tasks.shift()();
});await Promise.all(workers);
const summary=results.reduce((m,r)=>(m[r.status]=(m[r.status]||0)+1,m),{});
console.log("AUDIT_SUMMARY "+JSON.stringify({checks:results.length,...summary}));
if((summary.FAIL||0)||(summary.ERROR||0)) process.exitCode=1;
