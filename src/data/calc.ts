import Papa from "papaparse";
import { unzipSync, strFromU8 } from "fflate";
export interface Sheet {
  name: string;
  rows: string[][];
}
const maxRows = 10001,
  maxCols = 128;
const table = "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
  textNs = "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
  office = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const repeat = (e: Element, key: string) => {
  const n = Number(e.getAttributeNS(table, key) || 1);
  if (!Number.isSafeInteger(n) || n < 1)
    throw Error("Repetición inválida en la hoja.");
  return n;
};
function readXlsx(buffer: ArrayBuffer): Sheet[] {
  let expanded=0;
  const zip=unzipSync(new Uint8Array(buffer),{filter:e=>{
    if(!/^(xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml))$/.test(e.name))return false;
    expanded+=e.originalSize;if(expanded>32*1024*1024)throw Error("La hoja descomprimida supera 32 MB.");return true;
  }});
  const xml=(name:string)=>{if(!zip[name])throw Error("Falta "+name);const source=strFromU8(zip[name]);if(/<!DOCTYPE/i.test(source))throw Error("XML incompatible");const d=new DOMParser().parseFromString(source,"application/xml");if(d.querySelector("parsererror"))throw Error("XLSX dañado");return d;};
  const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const texts=(e:Element)=>Array.from(e.getElementsByTagNameNS(ns,"t")).map(t=>t.textContent||"").join("");
  const strings=zip["xl/sharedStrings.xml"]?Array.from(xml("xl/sharedStrings.xml").getElementsByTagNameNS(ns,"si")).map(texts):[];
  const relations=new Map(Array.from(xml("xl/_rels/workbook.xml.rels").getElementsByTagName("Relationship")).filter(e=>e.getAttribute("TargetMode")!=="External").map(e=>[e.getAttribute("Id"),e.getAttribute("Target")||""]));
  return Array.from(xml("xl/workbook.xml").getElementsByTagNameNS(ns,"sheet")).map(sheet=>{
    const relation=relations.get(sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id"));
    const path=relation?.startsWith("/")?relation.slice(1):"xl/"+relation;
    const d=xml(path),rows:string[][]=[];
    for(const row of Array.from(d.getElementsByTagNameNS(ns,"row"))){
      const values:string[]=[];
      for(const cell of Array.from(row.getElementsByTagNameNS(ns,"c"))){
        const letters=/^[A-Z]+/.exec(cell.getAttribute("r")||"")?.[0];
        const column=letters?Array.from(letters).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1:values.length;
        if(column>=maxCols)throw Error("Máximo 128 columnas.");
        const raw=cell.getElementsByTagNameNS(ns,"v")[0]?.textContent||"";
        const value=cell.getAttribute("t")==="s"?strings[Number(raw)]||"":cell.getAttribute("t")==="inlineStr"?texts(cell):raw;
        while(values.length<column)values.push("");values[column]=value;
      }
      if(values.some(Boolean))rows.push(values);
      if(rows.length>maxRows)throw Error("Máximo 10.000 registros.");
    }
    return {name:sheet.getAttribute("name")||"Hoja",rows};
  }).filter(s=>s.rows.length);
}
export async function readSheets(file: File): Promise<Sheet[]> {
  if (file.size > 10 * 1024 * 1024) throw Error("La hoja supera 10 MB.");
  if (/\.csv$/i.test(file.name)) {
    const p = Papa.parse<string[]>(await file.text(), {
      skipEmptyLines: "greedy",
      delimitersToGuess: [",", ";", "\t"],
    });
    const error = p.errors.find((e) => e.code !== "UndetectableDelimiter");
    if (error) throw Error("CSV incorrecto: " + error.message);
    if (p.data.length > maxRows || p.data.some((r) => r.length > maxCols))
      throw Error("Máximo 10.000 registros y 128 columnas.");
    return [{ name: file.name, rows: p.data }];
  }
  if (/\.xlsx$/i.test(file.name)) return readXlsx(await file.arrayBuffer());
  if (!/\.ods$/i.test(file.name))
    throw Error("Selecciona una tabla .xlsx, .ods o .csv.");
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(e) {
      if (e.name !== "content.xml") return false;
      if (e.originalSize > 32 * 1024 * 1024)
        throw Error("La hoja descomprimida supera 32 MB.");
      return true;
    },
  });
  if (!zip["content.xml"]) throw Error("Archivo ODS inválido.");
  const xml = strFromU8(zip["content.xml"]);
  if (/<!DOCTYPE/i.test(xml)) throw Error("Contenido XML incompatible.");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw Error("Contenido ODS dañado.");
  const spreadsheet = doc.getElementsByTagNameNS(office, "spreadsheet")[0];
  if (!spreadsheet) throw Error("Falta la hoja de cálculo.");
  return Array.from(spreadsheet.children)
    .filter((e) => e.namespaceURI === table && e.localName === "table")
    .map((sheet) => {
      const rows: string[][] = [];
      for (const row of Array.from(
        sheet.getElementsByTagNameNS(table, "table-row"),
      )) {
        const values: string[] = [];
        let column = 0;
        for (const cell of Array.from(row.children).filter((c) =>
          ["table-cell", "covered-table-cell"].includes(c.localName),
        )) {
          const count = repeat(cell, "number-columns-repeated");
          const paragraphs = Array.from(
            cell.getElementsByTagNameNS(textNs, "p"),
          );
          const value =
            paragraphs.map((p) => p.textContent || "").join("\n") ||
            [
              "date-value",
              "time-value",
              "value",
              "boolean-value",
              "string-value",
            ]
              .map((a) => cell.getAttributeNS(office, a))
              .find(Boolean) ||
            "";
          if (value) {
            if (column + count > maxCols)
              throw Error("Máximo 128 columnas con datos.");
            while (values.length < column) values.push("");
            for (let i = 0; i < count; i++) values.push(value);
          }
          column += count;
        }
        if (values.length) {
          const count = repeat(row, "number-rows-repeated");
          if (rows.length + count > maxRows)
            throw Error("Máximo 10.000 filas de datos por hoja.");
          for (let i = 0; i < count; i++) rows.push(values);
        }
      }
      return { name: sheet.getAttributeNS(table, "name") || "Hoja", rows };
    })
    .filter((s) => s.rows.length);
}

export function writeCsv(headers: string[], rows: string[][]) {
  return new Blob(
    [
      "\uFEFF",
      Papa.unparse([headers, ...rows], {
        delimiter: ";",
        newline: "\r\n",
        escapeFormulae: true,
      }),
    ],
    { type: "text/csv;charset=utf-8" },
  );
}

