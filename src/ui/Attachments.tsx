import { useEffect, useRef, useState } from "react";
import { Camera, Images, FolderOpen, FilePlus2, Download, X, ScanText, ScanLine, BookImage, Check, Search } from "lucide-react";
import { prepareFile, downloadBlob, maxFile, type Attachment, type Binaries } from "../data/media";
import { recognizeOcr, readCodes } from "../data/recognition";
import { canPreviewDocument, previewDocument } from "../data/documentPreview";

export interface FileDraft {
  refs: Attachment[];
  blobs: Binaries;
}
export const emptyFiles = (): FileDraft => ({ refs: [], blobs: new Map() });
type Recognition = { hash: string; name: string; text: string; method: "ocr" | "codes" };
const isImage = (file: Attachment) => file.kind === "photo";
type Preview = {
  name: string;
  kind: "photo" | "pdf" | "text";
  url?: string;
  content?: string;
};
// Un documento se visualiza siempre como texto sin ejecutar HTML ni scripts.
const pdfFile = /\.pdf$/i;
const isPdf = (f: Attachment) => pdfFile.test(f.name);

async function normalizeImage(file: File): Promise<File> {
  if (file.size <= maxFile && /^image\/(jpeg|png|webp|gif)$/i.test(file.type)) return file;
  if (!file.type.startsWith("image/")) throw Error("La fotografía debe tener un formato de imagen compatible.");
  if (file.size > 30 * 1024 * 1024) throw Error("Fotografía de más de 30 MB.");
  const image = await createImageBitmap(file).catch(() => {
    throw Error("No se pudo abrir esta imagen. Convierte HEIC/HEIF a JPG desde el dispositivo.");
  });
  try {
    const side = Math.min(1, 2500 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * side));
    canvas.height = Math.max(1, Math.round(image.height * side));
    const context = canvas.getContext("2d");
    if (!context) throw Error("No se pudo preparar la imagen.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    if (!jpeg) throw Error("No se pudo comprimir la fotografía.");
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    const result = new File([jpeg], name, { type: "image/jpeg" });
    if (result.size > maxFile) throw Error("La imagen optimizada supera 10 MB.");
    return result;
  } finally {
    image.close();
  }
}
export function Attachments({
  value, change, load, pending, library = [],
}: {
  pending?: (b: boolean) => void;
  value: FileDraft;
  change: (d: FileDraft) => void;
  load: (hash: string) => Promise<Blob | undefined>;
  library?: Attachment[];
}) {
  const [preview, show] = useState<Preview | null>(null);
  const [tab, setTab] = useState<"files" | "library">("files");
  const [filter, search] = useState("");
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [statusText, status] = useState("");
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const current = useRef(value);
  current.current = value;
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  const uniqueLibrary = Array.from(new Map(library.filter(isImage).map((f) => [f.hash, f])).values());
  const searchResults = uniqueLibrary.filter((f) => f.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).slice(0, 80);

  async function add(list: FileList | null, photo: boolean) {
    if (!list || gate.current) return;
    gate.current = true;
    setBusy(true);
    pending?.(true);
    status("");
    try {
      const refs = [...current.current.refs];
      const blobs = new Map(current.current.blobs);
      for (const original of Array.from(list)) {
        try {
          const file = photo ? await normalizeImage(original) : original;
          const ref = await prepareFile(file, photo);
          if (!refs.some((r) => r.hash === ref.hash && r.name === ref.name)) refs.push(ref);
          blobs.set(ref.hash, file);
        } catch (e) { status("No se añadió «" + original.name + "»: " + String(e)); }
      }
      change({ refs, blobs });
    } finally { gate.current = false; setBusy(false); pending?.(false); }
  }
  async function showFile(ref: Attachment) {
    if (busy) return;
    setBusy(true);
    status("");
    try {
      const blob = current.current.blobs.get(ref.hash) || await load(ref.hash);
      if (!blob) throw Error("El archivo no está disponible.");
      if (isImage(ref)) {
        show({ url: URL.createObjectURL(blob), name: ref.name, kind:"photo" });
      } else if (isPdf(ref)) {
        // Los blobs del servicio Windows pueden recibirse como octet-stream.
        // Forzamos el MIME para que el visor integrado reconozca el PDF.
        if (blob.size < 5 || !new Uint8Array(await blob.slice(0, 5).arrayBuffer())
          .every((n,i)=>n === [37,80,68,70,45][i]))
          throw Error("Este archivo no tiene una cabecera PDF válida.");
        show({ url: URL.createObjectURL(new Blob([blob], {type:"application/pdf"})),
          name:ref.name, kind:"pdf" });
      } else if (canPreviewDocument(ref.name)) {
        show({ name:ref.name, kind:"text", content:await previewDocument(blob, ref.name) });
      } else {
        throw Error("Este formato necesita una aplicación externa. Pulsa «Abrir en aplicación» para obtener el archivo original.");
      }
    } catch (e) { status(String(e)); }
    finally { setBusy(false); }
  }
  async function openExternal(ref: Attachment) {
    try {
      const blob = current.current.blobs.get(ref.hash) || await load(ref.hash);
      if (!blob) throw Error("El documento no está disponible.");
      downloadBlob(blob, ref.name);
      status("Archivo original descargado: " + ref.name + ". Ábrelo desde Descargas con Word, LibreOffice, Adobe Reader u otra aplicación instalada. El navegador no puede ejecutar aplicaciones externas directamente.");
    } catch (e) { status(String(e)); }
  }
  async function recognize(ref: Attachment, method: "ocr" | "codes") {
    if (busy) return;
    setBusy(true);
    pending?.(true);
    status(method === "ocr" ? "Reconociendo texto de la fotografía…" : "Buscando códigos QR y de barras…");
    try {
      const blob = current.current.blobs.get(ref.hash) || await load(ref.hash);
      if (!blob) throw Error("Fotografía no disponible.");
      const text = method === "ocr" ? await recognizeOcr(blob) : (await readCodes(blob)).join("\n");
      setRecognition({ hash: ref.hash, name: ref.name, method, text });
      status(text ? "Reconocimiento terminado. Revisa el resultado." : "No se detectó texto o código. Puedes corregirlo manualmente.");
    } catch (e) { status(String(e)); }
    finally { setBusy(false); pending?.(false); }
  }
  async function saveRecognition() {
    if (!recognition) return;
    const stem = recognition.name.replace(/\.[^.]+$/, "").slice(0, 120);
    const file = new File([recognition.text], stem + (recognition.method === "ocr" ? "-OCR.txt" : "-CODIGOS.txt"), { type: "text/plain" });
    const ref = await prepareFile(file, false);
    const currentDraft = current.current;
    const refs = currentDraft.refs.filter((r) => r.name !== ref.name);
    refs.push(ref);
    change({ refs, blobs: new Map([...currentDraft.blobs, [ref.hash, file]]) });
    setRecognition(null);
    status("Texto añadido como documento. Pulsa «Guardar registro» para conservarlo.");
  }
  function useFromLibrary(ref: Attachment) {
    if (current.current.refs.some((r) => r.hash === ref.hash)) return;
    change({ ...current.current, refs: [...current.current.refs, ref] });
    status("Fotografía incorporada. Guarda el registro para conservar el vínculo.");
  }
  return (
    <fieldset className="attachments photoWorkspace">
      <legend>Documentos y fotografías</legend>
      <div className="photoActions" aria-label="Añadir imágenes y documentos">
        <label className="photoAction" title="Tomar fotografía"><Camera size={20} /><span>Cámara</span>
          <input aria-label="Tomar foto" type="file" accept="image/*" capture="environment" disabled={busy}
            onChange={(e) => { void add(e.target.files, true); e.target.value = ""; }} />
        </label>
        <label className="photoAction" title="Elegir fotografías del dispositivo"><Images size={20}/><span>Dispositivo</span>
          <input aria-label="Elegir foto" type="file" accept="image/*,.heic,.heif,.avif" multiple disabled={busy}
            onChange={(e) => { void add(e.target.files, true); e.target.value = ""; }} />
        </label>
        <button type="button" className="photoAction" onClick={() => setTab(tab === "library" ? "files" : "library")} aria-expanded={tab === "library"}>
          <BookImage size={20}/><span>Biblioteca</span>
        </button>
        <label className="photoAction" title="Adjuntar documentos"><FilePlus2 size={20}/><span>Archivos</span>
          <input aria-label="Adjuntar archivo" type="file" multiple disabled={busy}
            onChange={(e) => { void add(e.target.files, false); e.target.value = ""; }} />
        </label>
      </div>
      <small>Hasta 10 MB por archivo guardado. Selección múltiple. Las fotografías grandes se optimizan cuando sea necesario.</small>
      {tab === "library" && (
        <div className="photoLibrary">
          <div className="libraryHeading"><FolderOpen size={18}/><strong>Fotografías guardadas en los módulos</strong></div>
          <label>Buscar fotografía
            <div className="inline"><Search size={17}/><input aria-label="Buscar fotografía en biblioteca" type="search" value={filter} onChange={(e) => search(e.target.value)} placeholder="Nombre del archivo…"/></div>
          </label>
          <div className="photoLibraryList">
            {searchResults.map((f) => <div className="photoLibraryItem" key={f.hash}>
              <span title={f.name}>{f.name}</span>
              <button type="button" onClick={() => void showFile(f)}>Ver</button>
              <button type="button" onClick={() => useFromLibrary(f)} disabled={value.refs.some((r) => r.hash === f.hash)}>
                {value.refs.some((r) => r.hash === f.hash) ? <><Check size={15}/> Añadida</> : "Seleccionar"}
              </button>
            </div>)}
            {!searchResults.length && <p>No hay fotografías disponibles en la biblioteca.</p>}
          </div>
        </div>
      )}
      {busy && <p role="status">Procesando fotografía o documentos…</p>}
      {value.refs.map((ref) => (
        <div className="photoEntry" key={ref.hash + ref.name}>
          <div className="photoEntryTitle"><span>{ref.name}</span><small>{Math.ceil(ref.size / 1024)} KB · {ref.kind === "photo" ? "Fotografía" : "Documento"}</small></div>
          <div className="photoEntryButtons">
            {ref.kind === "photo" && <>
              <button type="button" disabled={busy} onClick={() => void showFile(ref)}><Images size={15}/> Ver</button>
              <button type="button" disabled={busy} onClick={() => void recognize(ref, "ocr")}><ScanText size={15}/> OCR</button>
              <button type="button" disabled={busy} onClick={() => void recognize(ref, "codes")}><ScanLine size={15}/> Código</button>
            </>}
            {ref.kind !== "photo" && (isPdf(ref) || canPreviewDocument(ref.name)) && (
              <button type="button" disabled={busy} onClick={() => void showFile(ref)}>
                <FolderOpen size={15}/> Ver documento
              </button>
            )}
            {ref.kind !== "photo" && <button type="button" disabled={busy} onClick={() => void openExternal(ref)}><FolderOpen size={15}/> Abrir en aplicación</button>}
            <button type="button" onClick={async () => {
              try { const blob = value.blobs.get(ref.hash) || await load(ref.hash); if (!blob) throw Error("Archivo no disponible."); downloadBlob(blob, ref.name); }
              catch (e) { status(String(e)); }
            }}><Download size={15}/> Descargar</button>
            <button type="button" aria-label={"Quitar " + ref.name} disabled={busy} onClick={() =>
              change({ ...value, refs: value.refs.filter((f) => f !== ref) })
            }><X size={15}/> Quitar</button>
          </div>
        </div>
      ))}
      {recognition && (
        <div className="recognitionResult">
          <label>{recognition.method === "ocr" ? "Texto reconocido · " : "Códigos detectados · "}{recognition.name}
            <textarea aria-label="Texto reconocido editable" value={recognition.text}
              onChange={(e) => setRecognition({ ...recognition, text: e.target.value })} rows={6}
              placeholder="Revisa o escribe el texto reconocido…"/>
          </label>
          <div className="inline">
            <button type="button" onClick={() => downloadBlob(new Blob([recognition.text], {type:"text/plain;charset=utf-8"}), recognition.name + ".txt")}>Descargar TXT</button>
            <button type="button" className="primary" disabled={!recognition.text.trim()} onClick={() => void saveRecognition()}>Adjuntar texto al registro</button>
            <button type="button" onClick={() => setRecognition(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {preview && (
        <div className="photoLightbox documentPreview" role="region" aria-label={"Vista previa de " + preview.name}>
          <div className="inline documentPreviewHeader">
            <strong title={preview.name}>{preview.name}</strong>
            {preview.kind === "pdf" && preview.url && (
              <button type="button" onClick={() => window.open(preview.url, "_blank", "noopener,noreferrer")}>
                Abrir PDF en otra pestaña
              </button>
            )}
            <button type="button" onClick={() => show(null)}>Cerrar visor</button>
          </div>
          {preview.kind === "photo" && preview.url && (
            <img src={preview.url} alt={preview.name} className="photoPreview"/>
          )}
          {preview.kind === "pdf" && preview.url && (
            <>
              <iframe title={"PDF: " + preview.name} className="documentPdfFrame"
                src={preview.url} referrerPolicy="no-referrer"/>
              <small>Si tu navegador no muestra el PDF integrado, usa «Abrir PDF en otra pestaña» o «Descargar».</small>
            </>
          )}
          {preview.kind === "text" && (
            <><small>Vista rápida del texto, sin formato ni macros. Para ver el documento original con su diseño, usa «Abrir en aplicación».</small><pre className="documentTextPreview" tabIndex={0}>{preview.content || "(Documento vacío)"}</pre></>
          )}
        </div>
      )}
      {statusText && <p role="status" className="photoStatus">{statusText}</p>}
    </fieldset>
  );
}
