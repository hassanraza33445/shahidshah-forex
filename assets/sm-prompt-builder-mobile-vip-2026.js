/* Mobile-only optional-field disclosure for member Prompt Tools.
   Reacts to all four dynamic CMS-powered builder schemas. Does not change
   submitted field names, requirements, generated prompts, or desktop forms. */
(() => {
  "use strict";
  const embedded = new URLSearchParams(location.search).get("embedded")==="1" && window.parent!==window;
  const mobile = window.matchMedia("(max-width: 720px)");
  if (!embedded) return;
  function init() {
    const form = document.getElementById("builderForm");
    const fields = document.getElementById("fields");
    if (!form || !fields) return;
    const button = document.createElement("button");
    button.type="button";
    button.className="sm-vip-more-fields";
    button.hidden=true;
    button.setAttribute("aria-controls","fields");
    button.setAttribute("aria-expanded","false");
    const label=document.createElement("span");
    const symbol=document.createElement("span");
    symbol.setAttribute("aria-hidden","true");
    button.append(label,symbol);
    fields.insertAdjacentElement("afterend",button);
    let expanded=false;
    function render() {
      const enabled = mobile.matches;
      const all = [...fields.querySelectorAll(".field")];
      const optional=all.filter(field => {
        const el=field.querySelector("label .optional");
        return el && /^optional$/i.test((el.textContent||"").trim());
      });
      const folded=optional.slice(1); // Keep the first optional field visible.
      const showButton=enabled && folded.length>0;
      button.hidden=!showButton;
      button.setAttribute("aria-expanded",String(showButton && expanded));
      if (showButton) {
        label.textContent=expanded?"Hide optional details":"More options ("+folded.length+")";
        symbol.textContent=expanded?"−":"+";
      }
      all.forEach(field => field.classList.remove("sm-vip-hidden-optional"));
      if (showButton && !expanded) folded.forEach(field => field.classList.add("sm-vip-hidden-optional"));
    }
    button.addEventListener("click",() => {
      expanded=!expanded;
      render();
    });
    let queued=false;
    const observer=new MutationObserver(() => {
      if(queued)return;queued=true;
      queueMicrotask(() => { queued=false;expanded=false;render(); });
    });
    observer.observe(fields,{childList:true});
    mobile.addEventListener?.("change",() => {expanded=false;render();});
    render();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
