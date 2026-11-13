(()=>{"use strict";
const SUPABASE_URL="https://qggtdwixwafcmorepkks.supabase.co",KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const $=id=>document.getElementById(id);let client=null,mode="login",busy=false;
function safeNext(value){if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")||/\\|[\u0000-\u001f]/.test(value))return "/app/";try{const u=new URL(value,location.origin);if(u.origin!==location.origin||u.pathname.startsWith("/auth"))return "/app/";return u.pathname+u.search+u.hash}catch{return "/app/"}}
const qs=new URLSearchParams(location.search);let next=safeNext(qs.get("next")||sessionStorage.getItem("smshahid-next")||"/app/");
try{sessionStorage.setItem("smshahid-next",next)}catch{}
function message(text,error=false){$("authStatus").textContent=text;$("authStatus").classList.toggle("error",error)}
function setMode(value){mode=value;const signup=mode==="signup",reset=mode==="reset",recovery=mode==="recovery";
 $("signInTab").classList.toggle("selected",!signup);$("signUpTab").classList.toggle("selected",signup);
 $("signInTab").setAttribute("aria-selected",String(!signup));$("signUpTab").setAttribute("aria-selected",String(signup));
 $("nameField").hidden=!signup;$("passwordField").hidden=reset;
 $("fullname").required=signup;$("password").required=!reset;$("password").autocomplete=signup?"new-password":"current-password";
 $("authTitle").textContent=signup?"Create your account.":reset?"Reset your password.":recovery?"Choose a new password.":"Welcome back.";
 $("authSubtitle").textContent=signup?"Join the Market Intelligence and AI creation platform.":reset?"We will email you a secure reset link.":recovery?"Save a new password for your account.":"Sign in to continue to your private dashboard.";
 $("submitBtn").firstChild.textContent=signup?"Create Account ":reset?"Send Reset Link ":recovery?"Update Password ":"Login to Dashboard ";
 $("forgot").textContent=reset?"Back to Login":"Forgot password?";$("securityHint").textContent=signup?"Email confirmation may be required":"Secure account access";
 $("googleBtn").hidden=reset||recovery;$("signInTab").disabled=recovery;$("signUpTab").disabled=recovery;
 message("");
}
function working(value){busy=value;$("submitBtn").disabled=value;$("googleBtn").disabled=value;$("signInTab").disabled=value;$("signUpTab").disabled=value}
async function verifiedRedirect(){const {data,error}=await client.auth.getUser();if(error||!data?.user)return false;sessionStorage.removeItem("smshahid-next");location.replace(next);return true}
async function init(){if(!window.supabase?.createClient){message("Login service could not load. Please check your connection.",true);return}client=window.supabase.createClient(SUPABASE_URL,KEY);
 if(qs.has("error")||qs.has("error_description"))message(qs.get("error_description")||"Sign-in was not completed.",true);
 const {data:{session}}=await client.auth.getSession();
 if(session&&await verifiedRedirect())return;
 setMode(qs.get("mode")==="signup"?"signup":"login");
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.get("type")==="recovery"||qs.get("type")==="recovery"){setMode("recovery");message("Enter a new password to complete reset.")}
 client.auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"){setMode("recovery");message("Enter your new password.")}});
}
$("signInTab").addEventListener("click",()=>setMode("login"));
$("signUpTab").addEventListener("click",()=>setMode("signup"));
$("forgot").addEventListener("click",()=>setMode(mode==="reset"?"login":"reset"));
$("authForm").addEventListener("submit",async e=>{e.preventDefault();if(busy||!client)return;working(true);try{
 const email=$("email").value.trim(),password=$("password").value;
 if(mode==="reset"){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/auth/"});if(error)throw error;message("Password reset link sent if this email is registered.");return}
 if(mode==="recovery"){const {error}=await client.auth.updateUser({password});if(error)throw error;message("Password updated. Opening dashboard…");await verifiedRedirect();return}
 if(mode==="signup"){const fullname=$("fullname").value.trim();if(fullname.length<2)throw Error("Please enter your full name.");
 const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:fullname},emailRedirectTo:location.origin+"/auth/"}});if(error)throw error;
 if(data.session){await verifiedRedirect()}else message("Account created. Please check your email to verify your address, then log in.");return}
 const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
 if(!data.session||!await verifiedRedirect())throw Error("Unable to verify your session");
 }catch(err){message(err.message||"Unable to complete authentication.",true)}finally{working(false)}});
$("googleBtn").addEventListener("click",async()=>{if(!client||busy)return;working(true);try{
 const {error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/auth/"}});
 if(error)throw error;
 }catch(e){message(e.message||"Google login is not available.",true);working(false)}});
init().catch(e=>message("Unable to connect to authentication. Try refreshing.",true));
})();