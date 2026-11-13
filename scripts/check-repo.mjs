import {readdirSync,readFileSync,statSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {join,relative} from "node:path";
const cwd=process.cwd();
const required=["index.html","admin-panel.html","webinar-admin.html","learning-hub.html","CNAME","_redirects","vercel.json","about/index.html","course/index.html","community/index.html","videos/index.html","expo/index.html","social/index.html","supabase/sql/supabase-webinar-setup.sql"];
let errors=0;
for(const file of required){if(!existsSync(join(cwd,file))){console.error("MISSING required site file:",file);errors++;}}
const rootFiles=readdirSync(cwd).filter(name=>statSync(join(cwd,name)).isFile());
for(const name of rootFiles){if(/^(?:CHANGELOG-v|VERIFICATION-v).+\.txt$|\.sql$/i.test(name)){console.error("HISTORY FILE misplaced at repository root:",name);errors++;}}
const groups=new Map();
const skip=new Set([".git","node_modules",".vercel"]);
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(skip.has(e.name))continue;const loc=join(dir,e.name);if(e.isDirectory())walk(loc);else if(e.isFile() && /\.html$/i.test(e.name)){const digest=createHash("sha256").update(readFileSync(loc)).digest("hex");const paths=groups.get(digest)||[];paths.push(relative(cwd,loc));groups.set(digest,paths);}}}
walk(cwd);
console.log("HTML duplicate groups (report only; no deletion):");
for(const paths of groups.values())if(paths.length>1)console.log(paths.join(" = "));
console.log(errors?"Repository layout FAILED: "+errors+" issues.":"Repository layout OK. Public entrypoints preserved.");
process.exitCode=errors?1:0;
