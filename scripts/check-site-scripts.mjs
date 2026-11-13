import {readFileSync,existsSync} from "node:fs";
import {Script} from "node:vm";
const pages=["market-intelligence/index.html","content-studio/index.html"];
let errors=0;
for(const page of pages){
 if(!existsSync(page)){console.error("Missing page:",page);errors++;continue}
 const source=readFileSync(page,"utf8");
 const scripts=[...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
 let inline=0;
 for(const match of scripts){
  if(/\bsrc\s*=/.test(match[1]))continue;
  if(/type\s*=\s*["'](?:application\/ld\+json|importmap)/i.test(match[1]))continue;
  inline++;
  try{new Script(match[2],{filename:page})}
  catch(e){console.error("JavaScript syntax failure in "+page+": "+e.message);errors++}
 }
 if(!inline){console.error("No inline JavaScript in",page);errors++}
 if(!source.includes('name="viewport"')){console.error("Missing responsive viewport",page);errors++}
 if(page.includes("market-intelligence")&&!source.includes("market-intelligence-api")){console.error("News API not wired");errors++}
 if(page.includes("content-studio")&&!source.includes("shahid-content-ai")){console.error("AI API not wired");errors++}
 console.log(page+": "+inline+" inline script(s) syntax-checked");
}
if(errors)process.exit(1);
console.log("New application pages passed script syntax smoke checks.");
