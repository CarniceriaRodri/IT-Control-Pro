import { unzipSync, strFromU8 } from "fflate";
import type { Attachment } from "./media";

export type DocumentViewKind = "photo" | "pdf" | "text" | "office" | "unsupported";
export interface DocumentView {
  kind: Exclude<DocumentViewKind, "unsupported">;
  name: string;
  url?: string;
  text?: string;
  partial?: boolean;
  note?: string;
}
const textExtensions = /\.(txt|text|log|csv|tsv|md|markdown|json|xml|yaml|yml|ini|cfg|conf|properties|sql|bat|cmd|ps1|sh|py|js|jsx|ts|tsx|css|html|htm)$/i;
const imageExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
const maxPreviewBytes = 2 * 1024 * 1024;
const maxXmlBytes = 18 * 1024 * 1024;

export function classifyDocument(ref: Attachment): DocumentViewKind {
  if (ref.kind === "photo" || imageExtensions.test(ref.name)) return "photo";
  if (/\.pdf$/i.test(ref.name)) return "pdf";
  if (textExtensions.test(ref.name)) return "text";
  if (/\.(docx|odt)$/i.test(ref.name)) return "office";
  return "unsupported";
}

function safeXml(source: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw Error("El documento incluye definiciones XML no admitidas.");
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (xml.getElementsByTagName("parsererror").length)
    throw Error("El documento tiene un contenido XML incompatible.");
  return xml;
}

function extractOfficeText(data: Uint8Array, name: string): string {
  const entry = /\.docx$/i.test(name) ? "word/document.xml" : "content.xml";
  // Solo se descomprime el XML de contenido, con límite de tamaño.
  const zip = unzipSync(data, {
    filter(file) {
      if (file.name !== entry) return false;
      if (file.originalSize > maxXmlBytes)
        throw Error("El contenido del documento es demasiado grande para visualizarlo.");
      return true;
    },
  });
  if (!zip[entry]) throw Error("Este documento no contiene texto en un formato compatible.");
  const xml = safeXml(strFromU8(zip[entry]));
  let lines: string[];
  if (/\.docx$/i.test(name)) {
    const namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    lines = Array.from(xml.getElementsByTagNameNS(namespace, "p"), p =>
      Array.from(p.getElementsByTagNameNS(namespace, "t"), t => t.textContent || "").join("")
    );
  } else {
    const namespace = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
    const content = xml.getElementsByTagNameNS(
      "urn:oasis:names:tc:opendocument:xmlns:office:1.0", "text"
    )[0];
    lines = content ? Array.from(content.getElementsByTagName("*"))
      .filter(e => e.namespaceURI === namespace && ["p", "h"].includes(e.localName))
      .map(e => e.textContent || "") : [];
  }
  const text = lines.join("\n");
  if (!text.trim()) throw Error("No se ha podido extraer texto de este documento.");
  return text;
}

function decodeText(bytes: Uint8Array): string {
  // No se interpreta como HTML; la interfaz lo muestra siempre como texto.
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be").decode(bytes);
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text.includes("\ufffd") && !text.includes("\u0000")) {
    const legacy = new TextDecoder("windows-1252").decode(bytes);
    if (!legacy.includes("\ufffd")) return legacy;
  }
  return text;
}

export async function buildDocumentView(ref: Attachment, file: Blob): Promise<DocumentView> {
  const kind = classifyDocument(ref);
  if (kind === "unsupported")
    throw Error("No existe un visor interno para este formato. Puedes descargar el archivo y abrirlo con su aplicación.");
  if (kind === "photo") {
    return { kind, name: ref.name, url: URL.createObjectURL(file) };
  }
  if (kind === "pdf") {
    const pdf = file.type === "application/pdf" ? file : new Blob([file], {type: "application/pdf"});
    return { kind, name: ref.name, url: URL.createObjectURL(pdf),
      note: "El visor PDF depende de la compatibilidad del navegador. También puedes abrir el documento en otra pestaña." };
  }
  if (kind === "text") {
    const partial = file.size > maxPreviewBytes;
    const bytes = new Uint8Array(await file.slice(0, maxPreviewBytes).arrayBuffer());
    const text = decodeText(bytes);
    return {kind, name: ref.name, text, partial,
      note: partial ? "Vista parcial: el documento supera 2 MB. Descárgalo para consultar el contenido completo." : undefined};
  }
  if (file.size > 10 * 1024 * 1024) throw Error("El documento supera el límite de lectura.");
  const extracted = extractOfficeText(new Uint8Array(await file.arrayBuffer()), ref.name);
  const partial = extracted.length > 250_000;
  return {kind: "office", name: ref.name, text: extracted.slice(0, 250_000), partial,
    note: partial ? "Se muestra una parte del texto extraído; el archivo original permanece intacto." :
      "Vista de texto extraído: no conserva el diseño, tablas ni formato exacto del documento."};
}
