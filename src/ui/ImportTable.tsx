import { useState, useMemo } from "react";
import { readSheets, type Sheet } from "../data/calc";
import {
  field,
  uid,
  validate,
  type Module,
  type Dataset,
  type Entity,
} from "../domain/model";
import { Dialog } from "./Fields";
import type { Write } from "./Admin";
import { Attachments, emptyFiles } from "./Attachments";
const norm = (s: string) => s.trim().toLocaleLowerCase();
export function ImportTable({
  mod,
  data,
  name,
  write,
  close,
  load,
}: {
  mod?: Module;
  data: Dataset;
  name?: string;
  write: Write;
  close: () => void;
  load: (hash: string) => Promise<Blob | undefined>;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]),
    [idx, choose] = useState(0),
    [mapping, map] = useState<string[]>([]),
    [label, setLabel] = useState(name || ""),
    [error, err] = useState(""),
    [busy, work] = useState(false),
    [files, setFiles] = useState(emptyFiles);
  const sheet = sheets[idx],
    head = sheet?.rows[0] || [];
  function select(s: Sheet) {
    map(
      (s.rows[0] || []).map(
        (h) =>
          mod?.fields.find(
            (f) =>
              f.visible &&
              (norm(f.label) === norm(h) || norm(f.id) === norm(h)),
          )?.id || (mod ? "" : "new"),
      ),
    );
  }
  const plan = useMemo(() => {
    const problems: string[] = [],
      rows: Entity[] = [];
    let duplicates = 0;
    const target: Module = mod || {
      id: uid(),
      name: label.trim(),
      active: true,
      fields: [],
    };
    const matched = mapping.map((id, i) =>
      id === "new"
        ? field(uid(), head[i]?.trim() || "")
        : target.fields.find((f) => f.id === id),
    );
    if (!mod) target.fields = matched.flatMap((f) => (f ? [f] : []));
    const fields = matched.filter((f) => f !== undefined);
    if (
      !fields.length ||
      fields.some((f) => !f.label) ||
      new Set(fields.map((f) => norm(f.label))).size !== fields.length
    )
      problems.push(
        "Selecciona al menos una columna y evita encabezados vacíos o repetidos.",
      );
    if (
      !mod &&
      (!target.name ||
        data.modules.some((m) => norm(m.name) === norm(target.name)))
    )
      problems.push("Indica un nombre de módulo disponible.");
    const key = (v: Entity["values"]) =>
      JSON.stringify(
        fields.map((f) =>
          String(v[f.id] ?? "")
            .trim()
            .toLocaleLowerCase(),
        ),
      );
    const seen = new Set(
      data.records
        .filter((r) => r.module === target.id)
        .map((r) => key(r.values)),
    );
    const existing = [...data.records];
    for (const [i, line] of (sheet?.rows.slice(1) || []).entries()) {
      const values: Entity["values"] = {},
        id = uid();
      if (line.slice(head.length).some((v) => v.trim())) {
        problems.push("Fila " + (i + 2) + ": contiene valores sin encabezado.");
        continue;
      }
      for (const f of target.fields) {
        if (f.type === "identificador") values[f.id] = id;
        else if (f.initial) values[f.id] = f.initial;
      }
      matched.forEach((f, j) => {
        if (!f) return;
        const v = line[j]?.trim() || "";
        if (f.type === "identificador") return;
        values[f.id] =
          f.type === "selección múltiple"
            ? v.split("|").filter(Boolean)
            : f.type === "casilla"
              ? /^(sí|si|true|1)$/i.test(v)
                ? true
                : /^(no|false|0|)$/i.test(v)
                  ? false
                  : v
              : v;
      });
      const signature = key(values);
      if (seen.has(signature)) {
        duplicates++;
        continue;
      }
      try {
        if (
          fields.some(
            (f) => f.type === "casilla" && typeof values[f.id] !== "boolean",
          )
        )
          throw Error("Casilla inválida");
        validate(target, values, existing, id);
        const r = { id, module: target.id, values, rev: 1, archived: false };
        rows.push(r);
        existing.push(r);
        seen.add(signature);
      } catch (e) {
        problems.push("Fila " + (i + 2) + ": " + String(e));
      }
    }
    return { target, problems, rows, duplicates };
  }, [sheet, mapping, label, data, mod]);
  return (
    <Dialog
      name={
        mod ? "Importar tabla · " + mod.name : "Crear módulo desde una tabla"
      }
      close={close}
    >
      <div className="importBody">
        {!mod && (
          <label>
            Nombre del módulo
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
        )}
        <label>
          Tabla de LibreOffice Calc (.ods o .csv)
          <input
            type="file"
            accept=".ods,.csv"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              work(true);
              setSheets([]);
              err("");
              try {
                const list = await readSheets(f);
                if (!list[0]?.rows.length) throw Error("La tabla está vacía.");
                setSheets(list);
                choose(0);
                select(list[0]);
                if (!label) setLabel(f.name.replace(/\.[^.]+$/, ""));
              } catch (e) {
                err(String(e));
              } finally {
                work(false);
              }
            }}
          />
        </label>
        {sheet && (
          <>
            <label>
              Hoja
              <select
                value={idx}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  choose(i);
                  select(sheets[i]);
                }}
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <p>La primera fila contiene los nombres de las columnas.</p>
            {head.map((h, i) => (
              <label key={i}>
                {h || "Columna " + (i + 1)}
                <select
                  aria-label={h || "Columna " + (i + 1)}
                  value={mapping[i]}
                  onChange={(e) =>
                    map(mapping.map((v, j) => (j === i ? e.target.value : v)))
                  }
                >
                  <option value="">Omitir</option>
                  {mod ? (
                    mod.fields
                      .filter((f) => f.visible && f.type !== "identificador")
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))
                  ) : (
                    <option value="new">Crear campo de texto</option>
                  )}
                </select>
              </label>
            ))}
            <h3>Vista previa</h3>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    {head.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(1, 6).map((r, i) => (
                    <tr key={i}>
                      {head.map((_, j) => (
                        <td key={j}>{r[j]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {plan.rows.length} altas · {plan.duplicates} duplicadas omitidas ·{" "}
              {plan.problems.length} errores
            </p>
            {plan.problems.slice(0, 12).map((p, i) => (
              <small key={i}>{p}</small>
            ))}
          </>
        )}
        {!mod && (
          <Attachments
            value={files}
            change={setFiles}
            load={load}
            pending={work}
          />
        )}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={
            busy ||
            !sheet ||
            !!plan.problems.length ||
            (!plan.rows.length && !!mod)
          }
          onClick={async () => {
            work(true);
            try {
              const target = plan.target;
              await write(
                "Importar tabla",
                target.id,
                (d) => {
                  if (!mod) d.modules.push({ ...target, files: files.refs });
                  for (const r of plan.rows) d.records.push(r);
                },
                false,
                files.blobs,
              );
              close();
            } catch (e) {
              err(String(e));
            } finally {
              work(false);
            }
          }}
        >
          Confirmar importación
        </button>
      </div>
    </Dialog>
  );
}
