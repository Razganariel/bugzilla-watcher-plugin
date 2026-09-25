# Demo mode (screenshots for AMO)

This folder provides a **mock** of the extension UI using fictitious data
(`*.example.com`, invented Bugzilla tickets). It renders the **real** popup and
options pages — no production data is ever contacted.

`mock/` is **not** included in the built add-on (it is absent from `build.js SHARED`)
and must never be submitted to AMO.

## How to open the demo

The demo pages must be **served** (fetching the real pages and the locales is
blocked from `file://`; a banner explains the two options below).

### Option A — local HTTP server (no extension needed)

From the extension root:

```
python -m http.server 8000
```

then open:

- http://localhost:8000/mock/popup-demo.html
- http://localhost:8000/mock/options-demo.html

A fake `browser` is created automatically; nothing of yours is touched.

### Option B — inside the real add-on (recommended)

With the add-on loaded temporarily (`about:debugging` → *This Firefox* →
**Load Temporary Add-on** → `manifest.json`), open the **Inspect** console of
the background script and run:

```js
browser.tabs.create({ url: browser.runtime.getURL("mock/popup-demo.html") })
```

or for the options page:

```js
browser.tabs.create({ url: browser.runtime.getURL("mock/options-demo.html") })
```

3. Screenshot the page (DevTools responsive mode works well for the popup).

## URL parameters

| Param   | Values                          | Default | Effect                              |
| ------- | ------------------------------- | ------- | ----------------------------------- |
| `state` | `demo` `new` `error` `offline` `empty` | `demo`  | Display scenario                    |
| `lang`  | `fr` `en` `de` `es` `it` `nl`   | `fr`    | UI language                         |
| `theme` | `auto` `light` `dark`           | `auto`  | Color theme                         |
| `filter`| `all` `new`                     | `all`   | Popup severity filter               |

Example: light theme + English + error state:

```js
browser.tabs.create({ url: browser.runtime.getURL("mock/popup-demo.html?state=error&lang=en&theme=light") })
```

Scenario details (data is static, no network):

- `demo` — 8 new/updated tickets covering bloquante, critique, majeure,
  mineure, normale and évolution (watchMode `all`, filter pills visible).
- `new` — watchMode `new` (no filter pills).
- `error` — last detection failed (`Erreur HTTP 500`, 4 failures).
- `offline` — monitoring paused (Hors ligne).
- `empty` — no ticket detected yet.

## Files

- `mock-browser.js` — patches the real `browser` with a fake storage and
  `runtime.sendMessage` returning the fictitious state.
- `load-markup.js` — fetches the real `popup/popup.html` (or `options/options.html`)
  body, then loads the real `i18n.js`, `theme.js` and page script.
- `popup-demo.html` / `options-demo.html` — thin shells (real CSS via link).

The mock is covered by regression tests in `test/run-tests.js`
(`node test/run-tests.js`).