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
  if (!/\.ods$/i.test(file.name))
    throw Error("Selecciona una tabla .ods o .csv.");
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
