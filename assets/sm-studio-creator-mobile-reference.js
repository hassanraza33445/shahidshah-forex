/* Mobile-only Studio DOM placement for approved 3-step reference.
   Preserves original controls & bound event handlers. No data or auth changes. */
(() => {
 "use strict";
 if (window.parent === window || new URLSearchParams(location.search).get("embedded") !== "1") return;
 const mq = window.matchMedia("(max-width: 720px)");
 function init() {
   const createPage = document.getElementById("page-create");
   const first = createPage?.querySelector(".studio-news-card");
   const firstHead = first?.querySelector(".studio-panel-head");
   const selected = document.getElementById("studioSelectedNewsBox");
   const settings = createPage?.querySelector(".studio-settings-stack");
   const reset = document.getElementById("newProject");
   const intro = createPage?.querySelector(".studio-creation-intro");
   const list = document.getElementById("studioNewsList");
   const picker = document.getElementById("studioNewsPicker");
   const outputActions = createPage?.querySelector(".studio-output-actions");
   const pdf = document.getElementById("studioPdfExport");
   if (!first || !firstHead || !selected || !settings || !reset || !intro || !list || !picker || !outputActions || !pdf) return;

   const more = document.createElement("button");
   more.type = "button";
   more.className = "studio-mobile-more-news";
   more.textContent = "View more headlines ↓";
   more.hidden = true;
   more.addEventListener("click", () => {
     const expanded = list.classList.toggle("sm-expanded");
     more.textContent = expanded ? "Show fewer headlines ↑" : "View more headlines ↓";
     more.setAttribute("aria-expanded", String(expanded));
   });
   picker.appendChild(more);

   const extra = document.createElement("details");
   extra.className = "studio-mobile-more-actions";
   const summary = document.createElement("summary");
   summary.textContent = "More export options";
   const pdfProxy = document.createElement("button");
   pdfProxy.type = "button";
   pdfProxy.className = "btn small";
   pdfProxy.textContent = "↓ Print / PDF";
   pdfProxy.addEventListener("click", () => pdf.click());
   extra.append(summary, pdfProxy);

   function updateMore() {
     if (!mq.matches) {more.hidden = true;return;}
     const n = list.querySelectorAll(".studio-news-item").length;
     more.hidden = n <= 2;
     if (n <= 2) {
       list.classList.remove("sm-expanded");
       more.textContent = "View more headlines ↓";
       more.setAttribute("aria-expanded", "false");
     }
   }
   const observer = new MutationObserver(updateMore);
   observer.observe(list, {childList:true});

   function apply() {
     if (mq.matches) {
       if (selected.parentElement !== first) first.appendChild(selected);
       if (reset.parentElement !== firstHead) firstHead.appendChild(reset);
       reset.classList.add("studio-mobile-new-action");
       reset.textContent = "＋ New";
       if (extra.parentElement !== outputActions.parentElement) outputActions.insertAdjacentElement("afterend", extra);
     } else {
       if (selected.parentElement !== settings) settings.insertBefore(selected, settings.firstChild);
       if (reset.parentElement !== intro) intro.appendChild(reset);
       reset.classList.remove("studio-mobile-new-action");
       reset.textContent = "＋ New Script";
       extra.remove();
       list.classList.remove("sm-expanded");
     }
     updateMore();
   }
   mq.addEventListener?.("change", apply);
   apply();
 }
 if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
 else init();
})();
