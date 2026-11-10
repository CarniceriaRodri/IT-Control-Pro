import {
  readFileSync,
  writeFileSync,
  readdirSync,
  cpSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
rmSync("assets", { recursive: true, force: true });
cpSync("dist/assets", "assets", { recursive: true });
cpSync("dist/app.html", "index.html");
const files = [
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  ...readdirSync("assets").map((f) => "assets/" + f),
];
const hash = createHash("sha256");
for (const f of files) hash.update(readFileSync(f));
const sw = readFileSync("scripts/worker.js", "utf8")
  .replace("/*FILES*/ []", JSON.stringify(files))
  .replace(
    "__VERSION__",
    hash.update(readFileSync("scripts/worker.js")).digest("hex").slice(0, 12),
  );
writeFileSync("sw.js", sw);
