import type { Dataset } from "../domain/model";
export interface Attachment {
  hash: string;
  name: string;
  size: number;
  kind: "photo" | "document";
}
export type Binaries = Map<string, Blob>;
export const maxFile = 10 * 1024 * 1024;
export async function fingerprint(blob: Blob) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
  );
  return Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
}
export async function prepareFile(file: File, photo: boolean) {
  if (file.size > maxFile || !file.size)
    throw Error(
      "Cada archivo debe tener contenido y ocupar como máximo 10 MB.",
    );
  if (photo && !/^image\/(jpeg|png|webp|gif)$/i.test(file.type))
    throw Error("Selecciona una foto JPEG, PNG, WebP o GIF.");
  const ref: Attachment = {
    hash: await fingerprint(file),
    name: file.name,
    size: file.size,
    kind: photo ? "photo" : "document",
  };
  return ref;
}
export function references(data: Dataset) {
  const refs = new Map<string, Attachment>();
  for (const owner of [
    ...data.modules,
    ...data.records,
    ...data.history.flatMap((h) => [h.before, h.after]),
  ]) {
    if (!owner || owner.files === undefined) continue;
    if (!Array.isArray(owner.files)) throw Error("Lista de adjuntos dañada.");
    for (const f of owner.files) {
      if (
        !f ||
        !/^[a-f0-9]{64}$/.test(f.hash) ||
        typeof f.name !== "string" ||
        !f.name.trim() ||
        !Number.isInteger(f.size) ||
        f.size < 1 ||
        f.size > maxFile ||
        !["document", "photo"].includes(f.kind) ||
        (refs.has(f.hash) && refs.get(f.hash)!.size !== f.size)
      )
        throw Error("Referencia de archivo no válida.");
      refs.set(f.hash, f);
    }
  }
  return refs;
}
export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
