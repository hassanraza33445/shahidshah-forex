/* S M Shahid Shah — Supabase-managed mobile Tool Catalog
   Banner first, Video second, existing builders, then source-backed Downloads.
   Desktop layout is untouched. No hard-coded resource links or thumbnails. */
(() => {
  "use strict";
  const mobile = window.matchMedia("(max-width:720px)");
  const allowed = new Set(["banner","video","article","indicator","30days","downloads"]);
  const assetOrigin = "https://qggtdwixwafcmorepkks.supabase.co";
  const assetPrefix = "/storage/v1/object/public/download-assets/";
  function secureAsset(raw,folder) {
    if(typeof raw!=="string"||!raw)return null;
    try{
      const url=new URL(raw);
      if(url.protocol!=="https:"||url.origin!==assetOrigin||
        !url.pathname.startsWith(assetPrefix+folder+"/"))return null;
      return url;
    }catch{return null}
  }
  function make(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function addResource(container,item){
    const url=secureAsset(item.download_url,"resources");
    if(!url)return;
    const thumb=secureAsset(item.thumbnail_url,"thumbnails");
    const article=make("article","sm-tools-resource-card");
    const media=make("div","sm-tools-resource-thumb");
    if(thumb){
      const image=make("img");
      image.src=thumb.href;
      image.alt=String(item.title||"Download")+" thumbnail";
      image.loading="lazy";image.decoding="async";
      image.addEventListener("error",()=>{
        media.replaceChildren(make("span","","↓"));
      },{once:true});
      media.append(image);
    }else media.append(make("span","","↓"));
    const details=make("div","sm-tools-resource-info");
    const isPdf=url.pathname.toLowerCase().endsWith(".pdf");
    const kind=isPdf?"PDF RESOURCE":"EXCEL SHEET";
    details.append(make("span","sm-tools-resource-kind",kind));
    details.append(make("strong","",item.title||"Download resource"));
    if(item.description)details.append(make("p","",item.description));
    const link=make("a","sm-tools-resource-download",isPdf?"Download PDF ↓":"Download Sheet ↓");
    url.searchParams.set("download",(String(item.title||"resource").replace(/[^a-z0-9]+/gi,"-").slice(0,70)||"resource")+(isPdf?".pdf":".xlsx"));
    link.href=url.href;
    link.setAttribute("aria-label","Download "+String(item.title||"resource"));
    link.rel="noopener noreferrer";
    details.append(link);
    article.append(media,details);
    container.append(article);
  }
  // Unified Downloads panel: source-backed list on laptop AND mobile.
  // Prevents stale iframe builder screens when "Downloads" is selected.
  let resourceCache=null,resourceRequest=null;
  async function fetchPublishedResources(client){
    const {data,error}=await client.from("member_tool_catalog")
      .select("id,item_kind,title,description,display_order,thumbnail_url,download_url")
      .eq("item_kind","resource").order("display_order",{ascending:true});
    if(!error&&Array.isArray(data))return data;
    // Backwards-compatible fallback for sites with older exposed view settings.
    const fallback=await client.from("download_resources")
      .select("id,title,caption,thumbnail_url,download_url,display_order")
      .eq("is_published",true).order("display_order",{ascending:true});
    if(fallback.error)throw fallback.error;
    return (fallback.data||[]).map(row=>({
      ...row,item_kind:"resource",description:row.caption
    }));
  }
  window.SMRenderToolsDownloads=async function(client){
    const grid=document.getElementById("toolDownloadGrid");
    const counter=document.getElementById("toolDownloadCount");
    if(!grid)return;
    if(!client){
      grid.replaceChildren(make("p","sm-direct-downloads-message","Sign in to view your downloads."));
      return;
    }
    if(!resourceCache){
      grid.replaceChildren(make("p","sm-direct-downloads-message","Loading available downloads…"));
      if(!resourceRequest)resourceRequest=fetchPublishedResources(client).finally(()=>{resourceRequest=null;});
      try{resourceCache=await resourceRequest}
      catch(_){
        grid.replaceChildren(make("p","sm-direct-downloads-message","Unable to load downloads. Please try again."));
        return;
      }
    }
    // Check if still on the Downloads tab before modifying its contents.
    const resources=resourceCache.filter(item=>secureAsset(item.download_url,"resources"));
    if(counter)counter.textContent=resources.length+" "+(resources.length===1?"Resource":"Resources");
    const fragment=document.createDocumentFragment();
    for(const item of resources)addResource(fragment,item);
    grid.replaceChildren(fragment);
    if(!resources.length)grid.append(make("p","sm-direct-downloads-message","No published resources are available right now."));
  };
  window.SMSetupMobileToolCatalog=async function(client) {
    if(!client)return;
    const nav=document.querySelector("#view-tools .sm-prompt-tool-tabs");
    if(!nav||nav.dataset.catalogLoaded==="true")return;
    nav.dataset.catalogLoaded="true";
    const {data,error}=await client.from("member_tool_catalog")
      .select("id,item_kind,tool_slug,title,description,display_order,thumbnail_url,download_url")
      .order("display_order",{ascending:true});
    if(error||!Array.isArray(data)) {
      nav.dataset.catalogLoaded="false";
      console.warn("Mobile tool catalog unavailable; keeping default tool navigation.");
      return;
    }
    const eligible=data.filter(item=>item && (item.item_kind==="prompt" || item.item_kind==="folder") &&
      allowed.has(item.tool_slug));
    const buttons=[...nav.querySelectorAll(".sm-prompt-tool-tab[data-tool]")];
    buttons.forEach(button=>{
      const item=eligible.find(row=>row.tool_slug===button.dataset.tool);
      button.hidden=!item;
      if(!item)return;
      button.style.order=String(Number(item.display_order)||100);
      const name=button.querySelector("strong"),detail=button.querySelector("small");
      if(name&&item.title)name.textContent=item.title;
      if(detail&&item.description)detail.textContent=item.description;
    });

    // Downloads are rendered only when selected, in the dedicated native panel.
    if(document.getElementById("toolDownloadArea")?.hidden===false)
      void window.SMRenderToolsDownloads(client);
  };
})();