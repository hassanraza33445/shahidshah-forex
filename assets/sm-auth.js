(()=>{"use strict";
const SUPABASE_URL="https://qggtdwixwafcmorepkks.supabase.co",KEY="sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb";
const $=id=>document.getElementById(id);let client=null,mode="login",busy=false,googleEnabled=false,googleState="checking";
const CONSENT_VERSION="2026-11-14";
let pendingConfirmEmail="";
function selectedDial(){
 const select=$("dialCountry");
 const code=select.value==="other"?$("customDialCode").value.trim():select.selectedOptions[0]?.dataset?.dial||"";
 if(!/^\+[1-9]\d{0,3}$/.test(code))throw Error("Please select a valid country calling code.");
 return code;
}
function syncCountryChoice(){
 const select=$("dialCountry"),other=select.value==="other";
 $("customDialWrap").hidden=!other;
 $("customDialCode").required=mode==="signup"&&other;
 $("phone").placeholder=select.value==="PK"?"300 1234567":select.value==="MY"?"12 345 6789":"Mobile number";
}
function normalizedPhone(){
 const code=selectedDial(),countryDigits=code.slice(1);
 const raw=$("phone").value.trim();
 let digits=raw.replace(/\D/g,"");
 if(!digits)throw Error("Please enter your phone number.");
 if(/^\s*(\+|00)/.test(raw)){
  if(digits.startsWith("00"))digits=digits.slice(2);
  if(!digits.startsWith(countryDigits))throw Error("Phone number does not match the selected country code.");
  digits=digits.slice(countryDigits.length);
 }else if(code==="+92"&&digits.startsWith("92")&&digits.length===12)digits=digits.slice(2);
 else if(code==="+1"&&digits.startsWith("1")&&digits.length===11)digits=digits.slice(1);
 digits=digits.replace(/^0+/,"");
 const normalized=code+digits;
 if(code==="+92"&&!/^3\d{9}$/.test(digits))throw Error("Enter a valid Pakistani mobile number, e.g. 300 1234567.");
 if(digits.length<6||!/^[1-9]\d+$/.test(digits)||normalized.length-1<8||normalized.length-1>15)
  throw Error("Enter a valid mobile number for the selected country.");
 return normalized;
}

function updateGoogleAvailability(){
 const allowed=mode==="login"||mode==="signup";
 $("googleBtn").hidden=!allowed||!googleEnabled;
 $("googleSeparator").hidden=!allowed||!googleEnabled;
 $("googleBtn").disabled=busy||!googleEnabled;
}
async function checkGoogleProvider(){
 try{
  const res=await fetch(SUPABASE_URL+"/auth/v1/settings",{headers:{"apikey":KEY},cache:"no-store"});
  if(!res.ok)throw Error("Auth settings could not be checked");
  const data=await res.json();
  const flag=data?.external?.google??data?.external_google;
  googleEnabled=flag===true||flag==="true";
  googleState=googleEnabled?"enabled":"disabled";
 }catch(_){googleEnabled=false;googleState="unavailable";}
 updateGoogleAvailability();
}
function safeNext(value){if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")||/\\|[\u0000-\u001f]/.test(value))return "/app/";try{const u=new URL(value,location.origin);if(u.origin!==location.origin||u.pathname.startsWith("/auth"))return "/app/";return u.pathname+u.search+u.hash}catch{return "/app/"}}
const qs=new URLSearchParams(location.search);let next=safeNext(qs.get("next")||sessionStorage.getItem("smshahid-next")||"/app/");
try{sessionStorage.setItem("smshahid-next",next)}catch{}
function message(text,error=false){$("authStatus").textContent=text;$("authStatus").classList.toggle("error",error)}
function setMode(value){mode=value;const signup=mode==="signup",reset=mode==="reset",recovery=mode==="recovery";
 $("signInTab").classList.toggle("selected",!signup);$("signUpTab").classList.toggle("selected",signup);
 $("signInTab").setAttribute("aria-selected",String(!signup));$("signUpTab").setAttribute("aria-selected",String(signup));
 $("nameField").hidden=!signup;$("phoneField").hidden=!signup;$("termsField").hidden=!signup;$("passwordField").hidden=reset;
 $("fullname").required=signup;$("phone").required=signup;$("acceptTerms").required=signup;syncCountryChoice();$("password").required=!reset;$("password").autocomplete=signup?"new-password":"current-password";
 $("authTitle").textContent=signup?"Create your account.":reset?"Reset your password.":recovery?"Choose a new password.":"Welcome back.";
 $("authSubtitle").textContent=signup?"Join the Market Intelligence and AI creation platform.":reset?"We will email you a secure reset link.":recovery?"Save a new password for your account.":"Sign in to continue to your private dashboard.";
 $("submitBtn").firstChild.textContent=signup?"Create Account ":reset?"Send Reset Link ":recovery?"Update Password ":"Login to Dashboard ";
 $("forgot").textContent=reset?"Back to Login":"Forgot password?";$("securityHint").textContent=signup?"Email confirmation may be required":"Secure account access";
 updateGoogleAvailability();$("signInTab").disabled=recovery;$("signUpTab").disabled=recovery;
 $("resendConfirmation").hidden=true;
 message("");
}
function working(value){busy=value;$("submitBtn").disabled=value;$("googleBtn").disabled=value||!googleEnabled;$("signInTab").disabled=value;$("signUpTab").disabled=value;updateGoogleAvailability()}
async function verifiedRedirect(){const {data,error}=await client.auth.getUser();if(error||!data?.user)return false;sessionStorage.removeItem("smshahid-next");location.replace(next);return true}
async function init(){if(!window.supabase?.createClient){message("Login service could not load. Please check your connection.",true);return}client=window.supabase.createClient(SUPABASE_URL,KEY);
 const initialError=qs.has("error")||qs.has("error_description")?(qs.get("error_description")||"Sign-in was not completed."):null;
 const {data:{session}}=await client.auth.getSession();
 if(session&&await verifiedRedirect())return;
 setMode(qs.get("mode")==="signup"?"signup":"login");
 if(initialError)message(initialError,true);
 void checkGoogleProvider();
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.get("type")==="recovery"||qs.get("type")==="recovery"){setMode("recovery");message("Enter a new password to complete reset.")}
 client.auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"){setMode("recovery");message("Enter your new password.")}});
}
$("signInTab").addEventListener("click",()=>setMode("login"));
$("signUpTab").addEventListener("click",()=>setMode("signup"));
$("forgot").addEventListener("click",()=>setMode(mode==="reset"?"login":"reset"));
$("dialCountry").addEventListener("change",syncCountryChoice);
$("resendConfirmation").addEventListener("click",async()=>{
 if(!client||!pendingConfirmEmail||busy)return;
 $("resendConfirmation").disabled=true;
 try{
  const {error}=await client.auth.resend({type:"signup",email:pendingConfirmEmail,
    options:{emailRedirectTo:location.origin+"/auth/"}});
  if(error)throw error;
  message("Confirmation email requested. Check your inbox and spam folder.");
 }catch(err){message(err.message||"Unable to resend confirmation email.",true)}
 finally{$("resendConfirmation").disabled=false}
});
$("authForm").addEventListener("submit",async e=>{e.preventDefault();if(busy||!client)return;working(true);try{
 const email=$("email").value.trim(),password=$("password").value;
 if(mode==="reset"){const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/auth/"});if(error)throw error;message("Password reset link sent if this email is registered.");return}
 if(mode==="recovery"){const {error}=await client.auth.updateUser({password});if(error)throw error;message("Password updated. Opening dashboard…");await verifiedRedirect();return}
 if(mode==="signup"){
  const fullname=$("fullname").value.trim();
  if(fullname.length<2)throw Error("Please enter your full name.");
  if(!$("acceptTerms").checked){
    message("Please accept the Terms & Conditions before creating your account.",true);
    $("acceptTerms").focus();return;
  }
  const phone=normalizedPhone();
  const {data,error}=await client.auth.signUp({
   email,password,
   options:{data:{full_name:fullname,phone,country:$("dialCountry").value,terms_accepted:true,terms_version:CONSENT_VERSION,privacy_version:CONSENT_VERSION},emailRedirectTo:location.origin+"/auth/"}
  });
  if(error)throw error;
 if(data.session){message("Account created. Opening your dashboard…");await verifiedRedirect()}else {pendingConfirmEmail=email;$("resendConfirmation").hidden=false;message("Account created. Please check your email (including spam) for the confirmation link.");}return}
 const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
 if(!data.session||!await verifiedRedirect())throw Error("Unable to verify your session");
 }catch(err){message(err.message||"Unable to complete authentication.",true)}finally{working(false)}});
$("googleBtn").addEventListener("click",async()=>{if(!client||busy)return;if(!googleEnabled){message("Google sign-in is not configured yet. Use Email and Password.",true);return;}working(true);try{
 const {error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/auth/"}});
 if(error)throw error;
 }catch(e){message(e.message||"Google login is not available.",true);working(false)}});
init().catch(e=>message("Unable to connect to authentication. Try refreshing.",true));
})();