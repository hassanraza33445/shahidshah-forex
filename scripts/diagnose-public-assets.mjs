const urls=[
 "https://www.smshahidshah.com/ai-video-scripts/",
 "https://www.smshahidshah.com/learning-hub.html",
 "https://www.smshahidshah.com/assets/banners/video-light.webp",
 "https://www.smshahidshah.com/assets/banners/video-dark.webp",
 "https://www.smshahidshah.com/assets/banners/banner-light.webp",
 "https://www.smshahidshah.com/shahid-shah-profile.jpg",
 "https://smshahidshah.com/assets/banners/video-light.webp",
 "https://hassanraza33445.github.io/shahidshah-forex/assets/banners/video-light.webp",
 "https://hassanraza33445.github.io/assets/banners/video-light.webp"
];
for(const url of urls){
 try{
   const res=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(16000),cache:"no-store",headers:{"User-Agent":"S-M-Shahid-Shah-Site-Diagnostic/1.0","Cache-Control":"no-cache"}});
   const bytes=new Uint8Array(await res.arrayBuffer());const prefix=Buffer.from(bytes.slice(0,32)).toString("ascii").replace(/[^ -~]/g,"?");
   console.log(JSON.stringify({request:url,status:res.status,final:res.url,type:res.headers.get("content-type"),length:bytes.length,webp:prefix.startsWith("RIFF")&&prefix.slice(8,12)==="WEBP",head:prefix.slice(0,18),cache:res.headers.get("x-cache")||res.headers.get("cf-cache-status")||null}));
 }catch(e){console.log(JSON.stringify({request:url,error:String(e).slice(0,200)}))}
}
