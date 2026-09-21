(function () {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  let setting = "auto";
  let systemDark = null;

  function resolve() {
    if (setting === "dark" || setting === "light") {
      return setting;
    }
    if (systemDark !== null) {
      return systemDark ? "dark" : "light";
    }
    return mq.matches ? "dark" : "light";
  }

  function apply() {
    document.documentElement.dataset.theme = resolve();
  }

  function set(value) {
    setting = value || "auto";
    apply();
  }

  function load() {
    return browser.storage.local
      .get(["settings", "systemTheme"])
      .then(({ settings, systemTheme }) => {
        setting = (settings && settings.theme) || "auto";
        systemDark =
          systemTheme === "dark" ? true : systemTheme === "light" ? false : null;
        apply();
      });
  }

  function init() {
    if (mq.addEventListener) {
      mq.addEventListener("change", apply);
    }
    browser.storage.onChanged.addListener((changes) => {
      if (changes.settings || changes.systemTheme) {
        load();
      }
    });
    return load().catch(() => apply());
  }

  window.Theme = { init: init, set: set, apply: apply, resolve: resolve };
})();
