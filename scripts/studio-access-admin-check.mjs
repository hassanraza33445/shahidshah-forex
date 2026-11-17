import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=path=>readFileSync(path,"utf8");
const admin=file("admin-panel.html"),ui=file("assets/sm-admin-studio-access.html");
const css=file("assets/sm-admin-studio-access.css"),js=file("assets/sm-admin-studio-access.js");
const studio=file("content-studio/index.html"),api=file("supabase/functions/shahid-studio-access/index.ts");
for(const item of ['id="page-studioaccess"','id="saRoot"','data-page="studioaccess"','SMStudioAccessAdmin?.load()','sm-admin-studio-access.css','sm-admin-studio-access.js']){
 assert.ok(admin.includes(item),"Missing native Admin Panel mount: "+item)
}
assert.ok(!admin.includes("window.open('/content-studio/?view=access'"),"Old pop-out must be removed");
assert.ok(studio.includes('href="/admin-panel.html#studio-access"'),"Studio Access must link to central admin");
assert.ok(!studio.includes('id="accessForm"'),"Remove duplicate management form");
for(const id of ["saSearch","saFilter","saUsersBody","saTotalUsers","saActiveCount","saRemovedCount","saAdminCount","saGrant","saRevoke","saResend","saRole","saAuditList","saRefresh","saMore"]){
 assert.ok(ui.includes('id="'+id+'"'),"Missing admin control "+id)
}
for(const token of [
 'const admin=()=>typeof isLoggedIn', 'currentAdmin?.is_admin===true',
 'from("profiles")','from("content_access")','from("content_access_notifications")',
 'functions.invoke("shahid-studio-access"','window.confirm(',
 'type==="grant"','type==="revoke"','type==="resend"',
 'user.is_admin','S.actionBusy','textContent','Promise.all([metrics(),history()])',
 'submitted to SMTP provider (delivery not guaranteed)'
])assert.ok(js.includes(token),"Missing safe live function "+token);
for(const role of ["Creator","Viewer","Editor","Approver"])assert.ok(ui.includes(role),"Role missing "+role);
assert.ok(!ui.includes('value="admin"'),"Studio permission may not grant platform admin");
assert.ok(css.includes("@media(max-width:650px)")&&css.includes("var(--sa-gold)")&&css.includes("var(--sa-panel)"),"Scoped premium theme and responsive layout required");
assert.ok(api.includes("admin?.is_admin!==true"),"Server-side website admin identity check needed");
assert.ok(api.includes("target.is_admin===true"),"Must protect platform admin accounts from revoke");
assert.ok(api.includes('["viewer","creator","editor","approver"].includes(role)'),"No creator-admin escalation");
assert.ok(api.includes("content_access_notifications"),"Access changes must be audited");
assert.ok(api.includes("emailNotice"),"Access email notification path must stay connected");
console.log("PASS native premium Studio Admin layout, role actions, protected admins and email history");
