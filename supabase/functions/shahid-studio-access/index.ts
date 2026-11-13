import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import nodemailer from "npm:nodemailer@6.9.16";
const dbUrl=Deno.env.get("SUPABASE_URL")||"";
let v:any={};try{v=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||v.default||"";
const db=createClient(dbUrl,secret||"missing",{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const send=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clip=(s:any,n=180)=>String(s??"").trim().slice(0,n);
const esc=(s:any)=>clip(s,200).replace(/[&<>"']/g,(x)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"} as Record<string,string>)[x]);
async function emailNotice(address:string,name:string,role:string,action:string){
 const host=Deno.env.get("SMTP_HOST")||"",username=Deno.env.get("SMTP_USERNAME")||"",password=Deno.env.get("SMTP_PASSWORD")||"";
 if(!host||!username||!password)return {status:"skipped",error:"SMTP_NOT_CONFIGURED"};
 const isGrant=action!=="revoked";
 const title=isGrant?"AI Content Studio Access Granted":"AI Content Studio Access Removed";
 const detail=isGrant?("You now have "+role+" access to the S M Shahid Shah AI Content Studio."):"Your AI Content Studio access has been removed. If you believe this is a mistake, please contact your administrator.";
 const html='<html><body style="margin:0;padding:32px;background:#0d1421;font-family:Arial,sans-serif;color:#f5f2eb"><div style="max-width:580px;margin:auto;background:#131e2d;border:1px solid #3b3440;border-radius:20px;overflow:hidden"><div style="background:#eeb25c;padding:21px 28px;color:#1c170f;font-weight:800;font-size:18px">S M SHAHID SHAH</div><div style="padding:34px 28px"><div style="letter-spacing:2px;color:#eeb25c;font-size:11px">AI CONTENT STUDIO</div><h1 style="font-size:24px;margin:15px 0;color:#fff">'+esc(title)+'</h1><p style="font-size:15px;line-height:1.8">Hello '+esc(name)+',</p><p style="font-size:15px;line-height:1.8">'+esc(detail)+'</p>'+(isGrant?'<p><a style="display:inline-block;background:#eeb25c;color:#1c170f;padding:14px 22px;border-radius:11px;text-decoration:none;font-weight:bold" href="https://www.smshahidshah.com/content-studio/">Open AI Content Studio</a></p>':'')+'<p style="color:#a4afc1;font-size:12px;margin-top:35px">This is an automated account notification. Do not share your password.</p></div></div></body></html>';
 try{
  const port=Number(Deno.env.get("SMTP_PORT")||"465");
  const smtp=nodemailer.createTransport({host,port,secure:port===465,auth:{user:username,pass:password},connectionTimeout:10000,socketTimeout:15000});
  await smtp.sendMail({from:Deno.env.get("SMTP_FROM")||username,to:address,subject:title,html,text:"Hello "+name+", "+detail+(isGrant?" Open: https://www.smshahidshah.com/content-studio/":"")});
  return {status:"submitted",error:null};
 }catch(e){console.error("Studio email error",e instanceof Error?e.message:String(e));return {status:"failed",error:"SMTP_SEND_FAILED"}}
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return send({success:false,error:"POST required"},405);
 if(!dbUrl||!secret)return send({success:false,error:"Server not configured"},503);
 try{
  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!jwt)return send({success:false,error:"Sign in required"},401);
  const {data:{user},error}=await db.auth.getUser(jwt);
  if(error||!user)return send({success:false,error:"Invalid session"},401);
  const {data:admin}=await db.from("profiles").select("is_admin").eq("id",user.id).maybeSingle();
  if(admin?.is_admin!==true)return send({success:false,error:"Admin access required"},403);
  const body=await req.json();const action=clip(body.action,25);
  if(!["grant","revoke","resend"].includes(action))return send({success:false,error:"Unsupported action"},400);
  const address=clip(body.email,180).toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address))return send({success:false,error:"Valid registered email required"},400);
  const {data:target,error:targetError}=await db.from("profiles").select("id,full_name,email").ilike("email",address).maybeSingle();
  if(targetError||!target)return send({success:false,error:"No existing website account found. User must sign up first."},404);
  const {data:current}=await db.from("content_access").select("role,enabled").eq("user_id",target.id).maybeSingle();
  const role=action==="grant"?clip(body.role,20):current?.role||"viewer";
  if(!["viewer","creator","editor","approver","admin"].includes(role))return send({success:false,error:"Invalid role"},400);
  if(action==="grant"){
   const {error:change}=await db.from("content_access").upsert({user_id:target.id,role,enabled:true,granted_at:new Date().toISOString()},{onConflict:"user_id"});
   if(change)throw change;
  }else if(action==="revoke"){
   const {error:change}=await db.from("content_access").upsert({user_id:target.id,role,enabled:false},{onConflict:"user_id"});
   if(change)throw change;
  }else if(!current?.enabled)return send({success:false,error:"Cannot resend: access is not enabled"},409);
  const type=action==="revoke"?"revoked":action==="resend"?"resent":"granted";
  const outcome=await emailNotice(target.email||address,target.full_name||"Creator",role,type);
  await db.from("content_access_notifications").insert({user_id:target.id,action:type,role,delivery_status:outcome.status,error_code:outcome.error,acted_by:user.id});
  return send({success:true,access_updated:action!=="resend",enabled:action!=="revoke",role,email_status:outcome.status,email_error:outcome.error});
 }catch(e){console.error("Studio access management",e instanceof Error?e.message:String(e));return send({success:false,error:"Could not update Studio access"},500)}
});