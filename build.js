const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

const SHARED = [
  "background.js",
  "contentScript.js",
  "i18n.js",
  "theme.js",
  "popup",
  "options",
  "_locales",
  "icons",
  "LICENSE",
  "README.md"
];

const TARGETS = [
  { name: "mv3", manifest: "manifest.json" },
  { name: "mv2", manifest: "manifest.v2.json" }
];

function build() {
  fs.mkdirSync(DIST, { recursive: true });
  for (const target of TARGETS) {
    const outDir = path.join(DIST, target.name);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const asset of SHARED) {
      const src = path.join(ROOT, asset);
      if (!fs.existsSync(src)) {
        continue;
      }
      fs.cpSync(src, path.join(outDir, asset), { recursive: true });
    }
    fs.copyFileSync(
      path.join(ROOT, target.manifest),
      path.join(outDir, "manifest.json")
    );
    console.log("Built dist/" + target.name + " <- " + target.manifest);
  }
}

build();
