browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== "search") {
    return;
  }
  fetch(msg.query, { credentials: "same-origin" })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.message || "Erreur Bugzilla");
      }
      sendResponse({ ok: true, bugs: data.bugs || [] });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    });
  return true;
});