import { useEffect, useRef, useState } from "react";
import {
  prepareFile,
  downloadBlob,
  type Attachment,
  type Binaries,
} from "../data/media";
export interface FileDraft {
  refs: Attachment[];
  blobs: Binaries;
}
export const emptyFiles = (): FileDraft => ({ refs: [], blobs: new Map() });
export function Attachments({
  value,
  change,
  load,
  pending,
}: {
  pending?: (b: boolean) => void;
  value: FileDraft;
  change: (d: FileDraft) => void;
  load: (hash: string) => Promise<Blob | undefined>;
}) {
  const [preview, show] = useState<{ url: string; name: string } | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const [error, status] = useState(""),
    [busy, setBusy] = useState(false),
    gate = useRef(false);
  async function add(list: FileList | null, photo: boolean) {
    if (!list || gate.current) return;
    gate.current = true;
    setBusy(true);
    pending?.(true);
    status("");
    try {
      const refs = [...value.refs],
        blobs = new Map(value.blobs);
      for (const file of Array.from(list)) {
        const ref = await prepareFile(file, photo);
        if (!refs.some((r) => r.hash === ref.hash && r.name === ref.name)) {
          refs.push(ref);
          blobs.set(ref.hash, file);
        }
      }
      change({ refs, blobs });
    } catch (e) {
      status(String(e));
    } finally {
      gate.current = false;
      setBusy(false);
      pending?.(false);
    }
  }
  return (
    <fieldset className="attachments">
      <legend>Documentos y fotografías</legend>
      <div className="inline">
        {[
          ["Adjuntar archivo", "", false],
          ["Elegir foto", "image/jpeg,image/png,image/webp,image/gif", true],
          ["Tomar foto", "image/*", true],
        ].map(([label, accept, photo]) => (
          <label className="fileBtn" key={String(label)}>
            {label}
            <input
              aria-label={String(label)}
              type="file"
              accept={String(accept)}
              capture={label === "Tomar foto" ? "environment" : undefined}
              multiple={label !== "Tomar foto"}
              disabled={busy}
              onChange={(e) => {
                const files = e.target.files;
                void add(files, Boolean(photo));
                e.target.value = "";
              }}
            />
          </label>
        ))}
      </div>
      <small>Hasta 10 MB por archivo. La cámara depende del dispositivo.</small>
      {busy && <p>Preparando archivos…</p>}
      {value.refs.map((f) => (
        <div className="fieldRow" key={f.hash + f.name}>
          <span>
            {f.name} · {Math.ceil(f.size / 1024)} KB
          </span>
          {f.kind === "photo" && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const image = value.blobs.get(f.hash) || (await load(f.hash));
                  if (!image) throw Error("Foto no disponible");
                  show({ url: URL.createObjectURL(image), name: f.name });
                } catch (e) {
                  status(String(e));
                }
              }}
            >
              Ver foto
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                const b = value.blobs.get(f.hash) || (await load(f.hash));
                if (!b) throw Error("Archivo no disponible");
                downloadBlob(b, f.name);
              } catch (e) {
                status(String(e));
              }
            }}
          >
            Descargar
          </button>
          <button
            type="button"
            aria-label={"Quitar " + f.name}
            disabled={busy}
            onClick={() =>
              change({ ...value, refs: value.refs.filter((r) => r !== f) })
            }
          >
            Quitar
          </button>
        </div>
      ))}
      {preview && (
        <figure>
          <img className="photoPreview" src={preview.url} alt={preview.name} />
          <button type="button" onClick={() => show(null)}>
            Cerrar foto
          </button>
        </figure>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
