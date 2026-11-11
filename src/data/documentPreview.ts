import { unzipSync, strFromU8 } from "fflate";

/** Vista de lectura sin ejecutar scripts, macros ni contenido incrustado. */
export function canPreviewDocument(name: string): boolean {
  return /\.(?:txt|text|md|markdown|csv|tsv|log|json|xml|yaml|yml|ini|cfg|conf|sql|bat|cmd|ps1|sh|html|htm|css|js|ts|py|rtf|odt|docx)$/i.test(name);
}
const MAX_COMPRESSED = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED = 12 * 1024 * 1024;
const MAX_TEXT = 2 * 1024 * 1024;
function safeText(s: string): string {
  return s.slice(0, MAX_TEXT);
}
function xmlText(xml: string, type: "odt"|"docx"): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error("XML con entidades no permitido.");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw Error("Documento XML no válido.");
  const out: string[] = [];
  const isBlock=(element: Element) => type === "odt"
    ? element.namespaceURI === "urn:oasis:names:tc:opendocument:xmlns:text:1.0" && ["p","h"].includes(element.localName)
    : element.namespaceURI === "http://schemas.openxmlformats.org/wordprocessingml/2006/main" && element.localName === "p";
  const root = doc.documentElement;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let item: Node | null = walker.currentNode;
  while((item=walker.nextNode())){
    const e=item as Element;
    if (!isBlock(e)) continue;
    out.push(e.textContent?.trim() || "");
    if (out.join("\n").length > MAX_TEXT) break;
  }
  return safeText(out.join("\n"));
}
export async function previewDocument(blob: Blob, name: string): Promise<string> {
  if (blob.size > MAX_COMPRESSED) throw Error("Archivo demasiado grande para la vista integrada.");
  if (/\.(?:odt|docx)$/i.test(name)) {
    const zipped = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
      filter(file) {
        const target = /\.odt$/i.test(name) ? "content.xml" : "word/document.xml";
        if (file.name !== target) return false;
        if (file.originalSize > MAX_UNCOMPRESSED) throw Error("El contenido del documento supera el límite de vista previa.");
        return true;
      },
    });
    const target = /\.odt$/i.test(name) ? "content.xml" : "word/document.xml";
    const data = zipped[target];
    if(!data) throw Error("No se encontró el texto principal en este documento.");
    return xmlText(strFromU8(data), /\.odt$/i.test(name) ? "odt":"docx");
  }
  const bytes = await blob.arrayBuffer();
  let source: string;
  try {source=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}
  catch {source=new TextDecoder("windows-1252").decode(bytes);}
  if (/\.rtf$/i.test(name)) {
    if (!/^\s*\{\\rtf/i.test(source)) throw Error("El archivo RTF no tiene una cabecera válida.");
    // Extracción orientativa: para conservar el formato, abrir con LibreOffice/Word.
    const text = source.replace(/\\par[d]?\b/g,"\n")
      .replace(/\\tab\b/g,"\t")
      .replace(/\\'[0-9a-fA-F]{2}/g, (s)=>String.fromCharCode(parseInt(s.slice(2),16)))
      .replace(/\\u(-?\d+)\??/g,(_,n)=>String.fromCharCode((Number(n)+65536)%65536))
      .replace(/\{\\\*[^{}]*\}/g,"")
      .replace(/\\[A-Za-z]+-?\d* ?/g,"")
      .replace(/[{}]/g,"")
      .replace(/\\([{}\\])/g,"$1");
    return safeText(text);
  }
  return safeText(source);
}
