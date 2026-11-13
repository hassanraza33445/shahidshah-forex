import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
const url=Deno.env.get("SUPABASE_URL")||"";
let keys:any={};try{keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||keys.default||"";
const db=createClient(url,secret||"missing",{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
function reply(data:any,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors,status:204});
 if(req.method!=="POST")return reply({success:false,error:"POST required"},405);
 if(!url||!secret)return reply({success:false,error:"Backend configuration unavailable"},503);
 try{
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return reply({success:false,error:"Sign-in required"},401);
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return reply({success:false,error:"Invalid session"},401);
  const [profile,access]=await Promise.all([db.from("profiles").select("is_admin").eq("id",user.id).maybeSingle(),db.from("content_access").select("enabled,role").eq("user_id",user.id).maybeSingle()]);
  if(profile.data?.is_admin!==true&&!(access.data?.enabled&&["creator","editor","approver","admin"].includes(access.data.role)))return reply({success:false,error:"Studio access required"},403);
  const body=await req.json();const recordingId=String(body.recording_id||"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(recordingId))return reply({success:false,error:"Choose a valid saved recording"},400);
  const {data:row,error:dbError}=await db.from("content_recordings").select("id,storage_path,mime_type,size_bytes,owner_id").eq("id",recordingId).eq("owner_id",user.id).maybeSingle();
  if(dbError||!row)return reply({success:false,error:"Recording not found or not owned"},404);
  if(row.size_bytes>20000000)return reply({success:false,error:"Audio over 20 MB: split into smaller recordings"},413);
  const key=Deno.env.get("GROQ_API_KEY")||"";
  if(!key)return reply({success:false,error:"TRANSCRIPTION_PROVIDER_NOT_CONFIGURED",message:"Administrator must configure GROQ_API_KEY for transcription."},503);
  const down=await db.storage.from("shahid-studio-private").download(row.storage_path);
  if(down.error||!down.data)return reply({success:false,error:"Private recording could not be read"},502);
  const form=new FormData();
  form.append("model","whisper-large-v3-turbo");
  form.append("response_format","verbose_json");
  form.append("file",new File([down.data],"recording."+(row.mime_type?.includes("mp4")?"mp4":"webm"),{type:row.mime_type||"audio/webm"}));
  const res=await fetch("https://api.groq.com/openai/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+key},body:form,signal:AbortSignal.timeout(75000)});
  if(!res.ok){console.error("Transcription provider HTTP",res.status);return reply({success:false,error:"Transcription provider temporarily unavailable"},502)}
  const out=await res.json();
  const segments=Array.isArray(out?.segments)?out.segments.slice(0,250).map((s:any)=>({start:Number(s.start)||0,end:Number(s.end)||0,text:String(s.text||"").slice(0,400)})):[];
  return reply({success:true,text:String(out?.text||"").slice(0,100000),segments,language:out?.language||null});
 }catch(e){console.error("Transcription failed",e instanceof Error?e.message:String(e));return reply({success:false,error:"Could not transcribe this recording"},500)}
});