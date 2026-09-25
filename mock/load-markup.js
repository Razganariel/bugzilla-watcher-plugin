/*
 * Demo loader — fetches the REAL popup/options page and injects its body,
 * then loads the REAL i18n/theme/page scripts (in order).
 * This guarantees the mock renders exactly like the production UI.
 *
 * Works when served (extension page or local HTTP server). Does NOT work
 * from file:// (browser blocks the fetches) — a banner explains it.
 */
(function () {
  "use strict";

  const isOptions = /options-demo/.test(location.pathname);
  const page = isOptions ? "options/options.html" : "popup/popup.html";
  const pageScript = isOptions ? "../options/options.js" : "../popup/popup.js";
  const pageName = isOptions ? "Options" : "Popup";

  function load(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("impossible de charger " + url));
      document.body.appendChild(s);
    });
  }

  function banner(title, details) {
    const box = document.createElement("div");
    box.style.cssText =
      "margin:24px auto;max-width:520px;padding:16px;border:1px solid #b71c1c;" +
      "border-radius:8px;background:#fdecea;color:#222;font:14px/1.5 sans-serif;";
    const h = document.createElement("div");
    h.style.cssText = "font-weight:700;color:#b71c1c;margin-bottom:8px;";
    h.textContent = title;
    box.appendChild(h);
    const p = document.createElement("div");
    p.textContent = details;
    box.appendChild(p);
    document.body.appendChild(box);
  }

  fetch("../" + page)
    .then((r) => {
      if (!r.ok) {
        throw new Error("HTTP " + r.status);
      }
      return r.text();
    })
    .then((html) => {
      const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (!m) {
        throw new Error("corps HTML introuvable dans " + page);
      }
      document.body.innerHTML += m[1];
      return load("../i18n.js").then(() => load("../theme.js")).then(() => load(pageScript));
    })
    .catch((e) => {
      if (location.protocol === "file:") {
        banner(
          "Demo impossible en file://",
          "Cette page doit être servie. Deux options :\n" +
            "1) Extension chargée temporairement (about:debugging → Load Temporary Add-on " +
            "puis Inspect → browser.tabs.create({ url: browser.runtime.getURL(\"mock/" +
            (isOptions ? "options-demo.html" : "popup-demo.html") + "\") }))\n" +
            "2) Serveur local depuis la racine du module :\n" +
            "   python -m http.server 8000\n" +
            "   puis http://localhost:8000/mock/" +
            (isOptions ? "options-demo.html" : "popup-demo.html")
        );
      } else {
        banner("Demo " + pageName + " — erreur", e.message);
      }
    });
})();