(function () {
  const LOCALES = ["fr", "en", "de", "es", "it", "nl"];
  const dicts = {};

  async function loadDict(locale) {
    if (!dicts[locale]) {
      try {
        const url = browser.runtime.getURL("_locales/" + locale + "/messages.json");
        const res = await fetch(url);
        const json = await res.json();
        const map = {};
        for (const key of Object.keys(json)) {
          map[key] = json[key].message;
        }
        dicts[locale] = map;
      } catch (e) {
        dicts[locale] = {};
      }
    }
    return dicts[locale];
  }

  function detect() {
    let ui = "";
    try {
      ui = String((browser.i18n && browser.i18n.getUILanguage()) || "");
    } catch (e) {}
    if (!ui) {
      try {
        ui = String(navigator.language || "");
      } catch (e) {}
    }
ui = ui.toLowerCase();
  if (ui.indexOf("en") === 0) {
    return "en";
  }
  if (ui.indexOf("de") === 0) {
    return "de";
  }
  if (ui.indexOf("es") === 0) {
    return "es";
  }
  if (ui.indexOf("it") === 0) {
    return "it";
  }
  if (ui.indexOf("nl") === 0) {
    return "nl";
  }
  return "en";
  }

  function resolveLang(lang) {
    if (lang !== "auto" && LOCALES.indexOf(lang) >= 0) {
      return lang;
    }
    return "auto";
  }

  window.I18N = {
    activeLocale: "en",

    async init() {
      let lang = "auto";
      try {
        const { settings } = await browser.storage.local.get("settings");
        lang = (settings && settings.lang) || "auto";
      } catch (e) {}
      this.activeLocale = resolveLang(lang) === "auto" ? detect() : lang;
      await loadDict(this.activeLocale);
      await loadDict(this.activeLocale === "en" ? "fr" : "en");
    },

    async setLang(lang) {
      this.activeLocale = resolveLang(lang) === "auto" ? detect() : lang;
      await loadDict(this.activeLocale);
    },

    t(key, subs) {
      const map = dicts[this.activeLocale];
      const fallback = dicts.en || {};
      let msg = (map && map[key]) || fallback[key] || key;
      if (subs) {
        msg = msg.replace(/\{(\d+)\}/g, (m, i) => {
          const v = subs[Number(i)];
          return v != null ? String(v) : m;
        });
      }
      return msg;
    },

    applyPage() {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = this.t(el.getAttribute("data-i18n"));
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.placeholder = this.t(el.getAttribute("data-i18n-placeholder"));
      });
      document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        el.title = this.t(el.getAttribute("data-i18n-title"));
      });
      document.documentElement.lang = this.activeLocale;
    }
  };
})();