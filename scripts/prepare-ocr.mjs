/**
 * Descarga recursos OCR DE VERSIÓN FIJA para incluirlos en el paquete PWA.
 * Solo se ejecuta en el proceso de compilación, no en los dispositivos de los usuarios.
 * En producción, el navegador nunca necesita descargar scripts de terceros.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";

const base = "https://cdn.jsdelivr.net/npm/";
const files = [
  ["tesseract.min.js", base + "tesseract.js@5.1.1/dist/tesseract.min.js"],
  ["worker.min.js", base + "tesseract.js@5.1.1/dist/worker.min.js"],
  ...["tesseract-core", "tesseract-core-simd", "tesseract-core-lstm", "tesseract-core-simd-lstm"]
    .flatMap((stem) => [
      ["core/" + stem + ".wasm.js", base + "tesseract.js-core@5.0.0/" + stem + ".wasm.js"],
      ["core/" + stem + ".wasm", base + "tesseract.js-core@5.0.0/" + stem + ".wasm"],
    ]),
  ...["spa", "eng"].map((lang) => [
    "lang/" + lang + ".traineddata.gz",
    "https://tessdata.projectnaptha.com/4.0.0/" + lang + ".traineddata.gz"
  ]),
];

async function get(url) {
  let last;
  for (let retry = 0; retry < 3; retry++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw Error(`HTTP ${response.status} para ${url}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length < 2000) throw Error(`Archivo sospechosamente pequeño: ${url}`);
      return body;
    } catch (error) {
      last = error;
      if (retry < 2) await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 1000));
    }
  }
  throw last;
}
for (const [name, url] of files) {
  const target = join("ocr", name);
  await mkdir(dirname(target), { recursive: true });
  const bytes = await get(url);
  await writeFile(target, bytes);
  console.log(`OCR incluido: ${name} (${(bytes.byteLength / 1048576).toFixed(2)} MB)`);
}
console.log("Paquete OCR local preparado.");
