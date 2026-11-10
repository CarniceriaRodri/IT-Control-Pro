import { parseBackup, envelope } from "./backup";
import { references, fingerprint, downloadBlob, type Binaries } from "./media";
import type { Dataset } from "../domain/model";
export async function exportFull(
  data: Dataset,
  load: (hash: string) => Promise<Blob | undefined>,
) {
  const attachments: Record<string, string> = {};
  for (const [hash, ref] of references(data)) {
    const file = await load(hash);
    if (!file) throw Error("Falta el archivo " + ref.name);
    attachments[hash] = await new Promise<string>((ok, fail) => {
      const reader = new FileReader();
      reader.onerror = () => fail(reader.error);
      reader.onload = () => ok(String(reader.result).split(",")[1]);
      reader.readAsDataURL(file);
    });
  }
  downloadBlob(
    new Blob([JSON.stringify({ ...envelope(data), version: 3, attachments })], {
      type: "application/json",
    }),
    "IT-Control-Pro-" + new Date().toISOString().slice(0, 10) + ".json",
  );
}
export async function importFull(raw: string) {
  const b = JSON.parse(raw);
  const data = parseBackup(
      b.version === 3 ? JSON.stringify({ ...b, version: 2 }) : raw,
    ),
    files: Binaries = new Map();
  for (const [hash, ref] of references(data)) {
    const encoded = b.version === 3 && b.attachments?.[hash];
    if (
      typeof encoded !== "string" ||
      encoded.length !== 4 * Math.ceil(ref.size / 3)
    )
      throw Error("Archivo ausente o incompleto: " + ref.name);
    const blob = new Blob([
      Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
    ]);
    if (blob.size !== ref.size || (await fingerprint(blob)) !== hash)
      throw Error("Archivo dañado: " + ref.name);
    files.set(hash, blob);
  }
  for (const r of data.records) {
    const m = data.modules.find((m) => m.id === r.module)!;
    for (const f of m.fields.filter((f) => f.type === "relación")) {
      const v = r.values[f.id];
      if (
        v &&
        !data.records.some(
          (other) => other.id === v && other.module === f.target,
        )
      )
        throw Error("Referencia inexistente en " + m.name + " · " + f.label);
    }
  }
  return { data, files };
}
