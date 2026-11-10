import {
  readFileSync, writeFileSync, readdirSync, cpSync, rmSync, mkdirSync, existsSync
} from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

rmSync("assets", { recursive: true, force: true });
cpSync("dist/assets", "assets", { recursive: true });
cpSync("dist/app.html", "index.html");

mkdirSync("android", { recursive: true });
rmSync("android/assets", { recursive: true, force: true });
cpSync("dist/assets", "android/assets", { recursive: true });
cpSync("dist/app.html", "android/index.html");
rmSync("android/ocr", { recursive: true, force: true });
if (existsSync("ocr")) cpSync("ocr", "android/ocr", { recursive: true });

function allFiles(folder, base = folder) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const name = join(folder, entry.name);
    return entry.isDirectory() ? allFiles(name, base) : [relative(base, name).replaceAll("\\", "/")];
  });
}
const icons = ["icon.svg", "icon-192.png", "icon-512.png"];
const mainFiles = [
  "index.html", "manifest.webmanifest", ...icons,
  ...allFiles("assets").map((file) => "assets/" + file),
  ...allFiles("ocr").map((file) => "ocr/" + file),
];
const androidFiles = [
  "index.html", "manifest.webmanifest",
  ...allFiles("android/assets").map((file) => "assets/" + file),
  ...allFiles("android/ocr").map((file) => "ocr/" + file),
  ...icons.map((file) => "../" + file),
];
function createWorker(file, files, sourceRoot) {
  const hash = createHash("sha256");
  for (const name of files) hash.update(readFileSync(join(sourceRoot, name)));
  const base = readFileSync("scripts/worker.js", "utf8");
  hash.update(base);
  const version = hash.digest("hex").slice(0, 12);
  const output = base.replace("/*FILES*/ []", JSON.stringify(files))
    .replace("__VERSION__", version);
  writeFileSync(file, output);
}
createWorker("sw.js", mainFiles, ".");
createWorker("android/sw.js", androidFiles, "android");
