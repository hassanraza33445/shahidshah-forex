/* SM Shahid Shah PWA install workflow. No desktop layout changes. */
(() => {
  "use strict";
  const mobile = window.matchMedia("(max-width:720px)");
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);

  function initialize() {
    const trigger = document.getElementById("smInstallApp");
    const sheet = document.getElementById("smInstallSheet");
    const closeButton = document.getElementById("smInstallClose");
    const title = document.getElementById("smInstallTitle");
    const description = document.getElementById("smInstallDescription");
    const steps = document.getElementById("smInstallSteps");
    const action = document.getElementById("smInstallConfirm");
    const note = document.getElementById("smInstallNote");
    if (!trigger || !sheet || !closeButton || !title || !description || !steps || !action || !note) return;
    const label = trigger.querySelector("b");
    const subtitle = trigger.querySelector("small");

    function render() {
      const installed = isStandalone();
      if (label) label.textContent = installed ? "App Installed" : "Download App";
      if (subtitle) subtitle.textContent = installed ? "Opened as a standalone app" : "Add to Home Screen · Free";
      title.textContent = installed ? "App is already installed" : "Install SM Shahid Shah";
      description.textContent = installed
        ? "You're already using the standalone app experience."
        : "Keep your Market Intelligence and AI Studio workspace on your phone's home screen. No Play Store download required.";
      steps.replaceChildren();
      let instructions = [];
      if (installed) {
        instructions = ["The app opens directly from your home screen.", "Your account still needs an internet connection to access private data."];
      } else if (deferredPrompt) {
        instructions = ["Tap Install App below.", "Confirm the browser installation to add the app to your home screen."];
      } else if (isIOS()) {
        instructions = ["Open this website in Safari.", "Tap the Share icon, then choose Add to Home Screen.", "Confirm Add. Open the app from your home screen."];
      } else if (isAndroid()) {
        instructions = ["Open this website in Chrome (not an in-app browser).", "Tap the Chrome menu (⋮), then Install app or Add to Home screen.", "Confirm Install/Add to place it on your home screen."];
      } else {
        instructions = ["Open this website in a PWA-compatible browser.", "Use its menu to select Install app or Add to Home Screen."];
      }
      instructions.forEach((item, i) => {
        const step = document.createElement("div");
        step.className = "sm-install-step";
        const number = document.createElement("span");
        number.textContent = String(i + 1);
        const body = document.createElement("div");
        body.textContent = item;
        step.append(number, body);
        steps.appendChild(step);
      });
      action.textContent = !installed && deferredPrompt ? "Install App" : "Got It";
      note.textContent = installed ? "No additional installation needed." : "Free home-screen app · internet required for live data";
    }

    function close() {
      sheet.hidden = true;
      document.body.classList.remove("sm-install-open");
      trigger.focus();
    }

    trigger.addEventListener("click", () => {
      if (!mobile.matches) return;
      const sidebar = document.getElementById("appSidebar");
      const shade = document.getElementById("sideShade");
      const menuButton = document.getElementById("openMenu");
      sidebar?.classList.remove("open");
      if (shade) shade.hidden = true;
      menuButton?.setAttribute("aria-expanded", "false");
      render();
      sheet.hidden = false;
      document.body.classList.add("sm-install-open");
      closeButton.focus();
    });
    closeButton.addEventListener("click", close);
    sheet.addEventListener("click", event => { if (event.target === sheet) close(); });
    document.addEventListener("keydown", event => {
      if (!sheet.hidden && event.key === "Escape") close();
    });
    action.addEventListener("click", async () => {
      if (!deferredPrompt || isStandalone()) { close(); return; }
      const prompt = deferredPrompt;
      deferredPrompt = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === "accepted") {
          note.textContent = "Installation accepted. Follow your browser's final steps.";
          action.textContent = "Close";
        } else {
          render();
          note.textContent = "Installation cancelled. You can try again from the browser menu.";
        }
      } catch (_) {
        render();
        note.textContent = "Use your browser menu to install this app.";
      }
    });

    window.addEventListener("beforeinstallprompt", event => {
      if (!mobile.matches) return;
      event.preventDefault();
      deferredPrompt = event;
      if (!sheet.hidden) render();
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      render();
      note.textContent = "The app is now installed on your device.";
    });
    if (mobile.matches && "serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/app/sw.js", {scope:"/app/"}).catch(() => {
        // A failed SW registration should never interrupt login or navigation.
      });
    }
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {once:true});
  } else {
    initialize();
  }
})();
