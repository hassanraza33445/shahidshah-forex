/* Two-step paid USDT Mentorship flow — mobile only.
   Receipts stored privately, manual payment verification required.
   Wallet and price are fetched from admin-controlled Supabase settings.
   No fake wallet, assumed network, or automatic approval. */
(() => {
 "use strict";
 const onPhone=()=>window.matchMedia("(max-width:720px)").matches;
 const $=id=>document.getElementById(id);
 const allowedFileTypes=new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"],["application/pdf","pdf"]]);
 function val(id){return String($(id)?.value||"").trim()}
 function validWallet(network,address){
   if(network==="TRC20")return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
   if(network==="ERC20"||network==="BEP20")return /^0x[a-fA-F0-9]{40}$/.test(address);
   return false;
 }
 function setup({getClient,getUser,getProfile,refreshApplication}){
   const form=$("mentorshipForm"),next=$("mentorNext"),panel=$("mentorPaymentPanel"),
    details=$("mentorPaymentDetails"),unavailable=$("mentorPaymentUnavailable"),
    submit=$("mentorSubmit"),txid=$("mentorTxid"),proof=$("mentorProofFile"),
    back=$("mentorPaymentBack"),message=$("mentorMessage"),wallet=$("mentorUSDTAddress"),
    admin=$("mentorPaymentAdminConfig");
   if(!form||!next||!panel||!details||!unavailable||!submit||!txid||!proof||!back||!wallet||!admin)return;
   let settings=null,processing=false,submitted=false;
   const stepBadge=form.closest(".vip-application-box")?.querySelector(".application-heading > span");
   function syncStepBadge(){
     if(!stepBadge || !onPhone())return;
     stepBadge.textContent=panel.hidden?"Step 1 of 2":"Step 2 of 2";
   }

   function messageText(text){message.textContent=text;}
   function configured(data){
     if(!data || !data.enabled || !(Number(data.amount_usdt)>0) || !validWallet(data.network,String(data.wallet_address||"")))return false;
     return true;
   }
   async function fetchConfig(){
     const client=getClient();
     if(!client) {settings=null;render();return;}
     const {data,error}=await client.from("mentorship_payment_settings")
        .select("amount_usdt,network,wallet_address,enabled").eq("id",1).maybeSingle();
     if(error){settings=null;unavailable.textContent="Unable to retrieve payment details. Refresh or contact the mentorship team.";}
     else settings=data;
     const adminUser=Boolean(getProfile()?.is_admin);
     admin.hidden=!adminUser;
     if(adminUser && settings){
       $("mentorAdminUSDTNetwork").value=settings.network||"TRC20";
       $("mentorAdminUSDTAmount").value=settings.amount_usdt||"";
       $("mentorAdminUSDTAddress").value=settings.wallet_address||"";
     }
     render();
   }
   function render(){
     const active=configured(settings);
     details.hidden=!active;
     unavailable.hidden=active;
     if(!active && !unavailable.textContent.includes("Unable")) {
       unavailable.textContent="USDT wallet and mentorship fee have not been configured yet. Do not send money until the official details appear here.";
     }
     if(active){
       $("mentorUSDTAmount").textContent=Number(settings.amount_usdt).toFixed(2)+" USDT";
       $("mentorUSDTNetwork").textContent=settings.network;
       wallet.textContent=settings.wallet_address;
     }else wallet.textContent="Wallet not configured";
     txid.disabled=!active || submitted;
     proof.disabled=!active || submitted;
     submit.disabled=!active || processing || submitted;
     submit.textContent=processing?"Submitting for review…":submitted?"Payment Submitted":"Submit Payment for Verification →";
   }
   function validateFirstStep(){
     const ids=["mentorName","mentorPhone","mentorInterest","mentorGoals"];
     for(const id of ids){
       const input=$(id);
       if(!input.checkValidity()){input.reportValidity();input.focus();return false;}
     }
     if(val("mentorName").length<2||val("mentorPhone").length<6||val("mentorGoals").length<12){
       messageText("Please enter your full name, contact number and goals before proceeding.");
       return false;
     }
     messageText("");
     return true;
   }
   function openPayment(){
     if(!onPhone()||!validateFirstStep())return;
     panel.hidden=false;
     form.classList.add("sm-mentor-payment-active");
     syncStepBadge();
     txid.required=true;
     submit.textContent="Submit Payment for Verification →";
     render();
     void fetchConfig();
     panel.scrollIntoView({behavior:"smooth",block:"start"});
   }
   next.addEventListener("click",openPayment);
   back.addEventListener("click",()=>{
     panel.hidden=true;
     syncStepBadge();
     txid.required=false;
     form.classList.remove("sm-mentor-payment-active");
     messageText("");
     $("mentorName").focus({preventScroll:true});
     form.closest(".vip-application-box")?.scrollIntoView({behavior:"smooth",block:"start"});
   });
   $("mentorCopyUSDT").addEventListener("click",async()=>{
     if(!configured(settings))return;
     const text=settings.wallet_address;
     try{
       await navigator.clipboard.writeText(text);
       messageText("Wallet address copied. Verify the USDT network before sending funds.");
     }catch(_){
       messageText("Select and copy the displayed wallet address manually.");
     }
   });

   $("mentorAdminUSDTSave").addEventListener("click",async()=>{
     if(!onPhone()||!getProfile()?.is_admin)return;
     const network=val("mentorAdminUSDTNetwork");
     const amount=Number(val("mentorAdminUSDTAmount"));
     const address=val("mentorAdminUSDTAddress");
     const status=$("mentorAdminUSDTMessage");
     if(!(amount>0)||!Number.isFinite(amount)||!validWallet(network,address)){
       status.textContent="Enter a valid amount and a wallet address matching the selected USDT network.";return;
     }
     const button=$("mentorAdminUSDTSave");
     button.disabled=true;status.textContent="Saving official payment details…";
     try{
       const {error}=await getClient().from("mentorship_payment_settings")
        .update({network,amount_usdt:amount,wallet_address:address,enabled:true,updated_at:new Date().toISOString()})
        .eq("id",1);
       if(error)throw error;
       status.textContent="Payment settings activated. Always confirm the address is correct.";
       unavailable.textContent="";
       await fetchConfig();
     }catch(e){status.textContent=e.message||"Failed to save payment settings.";}
     finally{button.disabled=false;}
   });

   // Capturing listener stops only the original desktop free-application handler on mobile.
   form.addEventListener("submit",async e=>{
     if(!onPhone())return;
     e.preventDefault();e.stopImmediatePropagation();
     if(processing||submitted)return;
     if(panel.hidden){openPayment();return;}
     if(!configured(settings)){
       messageText("USDT wallet and fee are not configured. Payment is not yet available.");return;
     }
     if(!validateFirstStep())return;
     const hash=val("mentorTxid");
     if(!/^[A-Za-z0-9_-]{16,180}$/.test(hash)){
       messageText("Enter the full transaction hash, at least 16 characters.");txid.focus();return;
     }
     const file=proof.files?.[0]||null;
     if(file && (!allowedFileTypes.has(file.type)||file.size>5*1024*1024)){
       messageText("Receipt must be PNG, JPG, WEBP or PDF and no larger than 5 MB.");return;
     }
     const client=getClient(),user=getUser();
     if(!client||!user){messageText("Session expired. Please sign in again.");return;}
     processing=true;render();messageText("Securing your payment proof for manual review…");
     try{
       let proofPath=null;
       if(file){
         const ext=allowedFileTypes.get(file.type);
         const name=(globalThis.crypto?.randomUUID?.()||String(Date.now())+"-"+Math.floor(Math.random()*1e8))+"."+ext;
         proofPath=user.id+"/"+name;
         const {error:uploadError}=await client.storage.from("mentorship-payment-proofs")
           .upload(proofPath,file,{contentType:file.type,upsert:false});
         if(uploadError)throw uploadError;
       }
       const {error}=await client.rpc("submit_paid_mentorship_application",{
         p_full_name:val("mentorName"),p_whatsapp:val("mentorPhone"),
         p_interest:val("mentorInterest"),p_goals:val("mentorGoals"),
         p_transaction_hash:hash,p_proof_path:proofPath
       });
       if(error)throw error;
       submitted=true;
       messageText("USDT payment details submitted successfully. Your application is awaiting manual payment verification; it is not approved yet.");
       try{await refreshApplication();}catch(_){}
       messageText("Payment proof received — pending manual verification. The team will review it before approval.");
     }catch(err){
       messageText(err.message||"Unable to submit payment proof. Please try again.");
     }finally{processing=false;render();}
   },true);

   window.addEventListener("sm:paid-mentor-refresh",()=>{if(onPhone())void fetchConfig()});
   // First fetch only after the user navigates to the paid step, when auth is ready.
   if(onPhone()){
     syncStepBadge();
     const btn=submit;
     btn.textContent="Submit Payment for Verification →";
     btn.disabled=true;
   }
 }
 window.SMSetupPaidMentorship=setup;
})();
