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
    [skipDuplicates, setSkipDuplicates] = useState(false),
    [fillMatching, setFillMatching] = useState(false),
    [label, setLabel] = useState(name || ""),
    [error, err] = useState(""),
    [busy, work] = useState(false),
    [files, setFiles] = useState(emptyFiles);
  const sheet = sheets[idx],
    // Algunas hojas tienen celdas con datos más allá de los encabezados.
    // Nunca descartamos esas columnas: les damos un nombre provisional.
    width = sheet ? Math.max(...sheet.rows.map(row => row.length), 0) : 0,
    head = Array.from({ length: width }, (_, i) => sheet?.rows[0]?.[i] ?? ""),
    columnLabel = (i: number) => head[i]?.trim() ? head[i] : "Columna " + (i + 1);
  function select(s: Sheet) {
    const columns = Math.max(...s.rows.map(row => row.length), 0);
    const used = new Set<string>();
    map(Array.from({ length: columns }, (_, i) => {
      const heading = s.rows[0]?.[i] ?? "";
      const existing = heading.trim() && mod?.fields.find(f =>
        f.visible && f.type !== "identificador" && !used.has(f.id) &&
        (norm(f.label) === norm(heading) || norm(f.id) === norm(heading))
      );
      if (existing) {
        used.add(existing.id);
        return existing.id;
      }
      // Por defecto nunca se omiten columnas desconocidas.
      return "new";
    }));
  }
  const plan = useMemo(() => {
    const problems: string[] = [],
      rows: Entity[] = [],
      updates: Entity[] = [];
    let duplicates = 0, matchedByKey = 0, changedByKey = 0;
    // Se crea una nueva definición; nunca se modifica la del módulo hasta confirmar.
    const target: Module = mod
      ? { ...mod, fields: [...mod.fields] }
      : { id: uid(), name: label.trim(), active: true, fields: [] };
    const matched = mapping.map((id, i) =>
      id === "new"
        ? field(uid(), columnLabel(i))
        : target.fields.find((f) => f.id === id),
    );
    const created = matched.filter((f): f is NonNullable<typeof f> =>
      !!f && !target.fields.some(old => old.id === f.id)
    );
    target.fields.push(...created);
    const fields = matched.filter((f): f is NonNullable<typeof f> => !!f);
    // Los encabezados repetidos se admiten como campos separados (UUID distintos).
    // Dos columnas no pueden volcarse al mismo campo existente.
    if (!fields.length || new Set(fields.map(f => f.id)).size !== fields.length)
      problems.push("Selecciona campos distintos para cada columna importada.");
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
    const existing = data.records.map(r => ({ ...r, values: { ...r.values } }));
    const primary = target.fields.find(f => f.keyRole === "primary" && f.type !== "relación");
    const normal = (v: unknown) => String(v ?? "").normalize("NFKC").trim().toLocaleLowerCase("es");
    for (const [i, line] of (sheet?.rows.slice(1) || []).entries()) {
      const values: Entity["values"] = {},
        id = uid();
      // Una fila completamente vacía no constituye un registro.
      if (line.every(v => !v.trim())) continue;
      for (const f of target.fields) {
        if (f.type === "identificador") values[f.id] = id;
        else if (f.initial) values[f.id] = f.initial;
      }
      matched.forEach((f, j) => {
        if (!f) return;
        // Se preserva el texto original de la celda, incluidos sus espacios.
        const v = line[j] ?? "";
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
      const same = mod && primary && normal(values[primary.id])
        ? data.records.filter(r => r.module === target.id && !r.archived &&
            normal(r.values[primary.id]) === normal(values[primary.id])) : [];
      if (same.length > 1) {
        problems.push("Fila " + (i + 2) + ": clave principal ambigua; revisa los registros existentes.");
        continue;
      }
      if (same.length === 1) {
        matchedByKey++;
        if (!fillMatching) {
          problems.push("Fila " + (i + 2) + ": identificador principal ya existente; activa «Completar campos vacíos» o revisa el archivo.");
          continue;
        }
        const record = existing.find(r => r.id === same[0].id)!;
        const additions: Entity["values"] = {};
        for (const f of fields) {
          const incoming = values[f.id], current = record.values[f.id];
          if ((current === null || current === undefined || current === "") &&
            incoming !== null && incoming !== undefined && incoming !== "")
            additions[f.id] = incoming;
        }
        const candidate: Entity = { ...record, values: { ...record.values, ...additions }, rev: record.rev + 1 };
        try {
          validate(target, candidate.values, existing, candidate.id);
          if (Object.keys(additions).length) {
            const previous = updates.findIndex(item => item.id === candidate.id);
            const original = data.records.find(item => item.id === candidate.id)!;
            const staged = { ...candidate, rev: original.rev + 1 };
            if (previous >= 0) updates[previous] = staged;
            else updates.push(staged);
            const where = existing.findIndex(r => r.id === candidate.id);
            existing[where] = candidate;
            changedByKey++;
          }
        } catch(e) {
          problems.push("Fila " + (i + 2) + ": " + String(e));
        }
        continue;
      }
      const signature = key(values);
      if (seen.has(signature)) {
        duplicates++;
        if (skipDuplicates) continue;
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
    return { target, created, problems, rows, updates, duplicates, matchedByKey, changedByKey };
  }, [sheet, mapping, label, data, mod, skipDuplicates, fillMatching]);
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
            <p>Los nombres y valores del archivo se conservan. Cada columna desconocida crea
              automáticamente un campo nuevo; los campos existentes no se sustituyen.</p>
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
                  <option value="new">Crear campo nuevo: {columnLabel(i)}</option>
                  <option value="">Omitir columna (opcional)</option>
                  {mod?.fields
                    .filter((f) => f.visible && f.type !== "identificador")
                    .map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
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
            <label className="check">
              <input type="checkbox" checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)} />
              Omitir filas idénticas (por defecto se conservan todas)
            </label>
            {mod?.fields.some(f => f.keyRole === "primary") && (
              <label className="check">
                <input type="checkbox" checked={fillMatching}
                  onChange={e => setFillMatching(e.target.checked)} />
                Completar únicamente campos vacíos de registros cuyo identificador principal coincida.
                Nunca sustituir información existente.
              </label>
            )}
            <p>
              {plan.created.length} campos nuevos · {plan.rows.length} altas ·
              {plan.matchedByKey} coincidencias por identificador ·
              {plan.changedByKey} registros para completar ·
              {plan.duplicates} duplicados de contenido
              {skipDuplicates ? " omitidos" : " conservados"} · {plan.problems.length} errores
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
            (!plan.rows.length && !plan.updates.length && !!mod)
          }
          onClick={async () => {
            work(true);
            try {
              const target = plan.target;
              await write(
                "Importar tabla",
                target.id,
                (d) => {
                  if (!mod) {
                    d.modules.push({ ...target, files: files.refs });
                  } else {
                    const previous = d.modules.find(m => m.id === target.id);
                    if (!previous) throw Error("Módulo inexistente.");
                    // Solo se anexan los campos nuevos. Nunca se eliminan los anteriores.
                    previous.fields.push(...plan.created);
                  }
                  for (const r of plan.rows) d.records.push(r);
                  for (const r of plan.updates) {
                    const index = d.records.findIndex(item => item.id === r.id);
                    if (index < 0) throw Error("Registro coincidente no encontrado; vuelve a cargar.");
                    // Se vuelven a comprobar los valores para no sobrescribir cambios ajenos.
                    const original = d.records[index];
                    if (original.rev !== r.rev - 1)
                      throw Error("Un registro cambió desde la vista previa; importa otra vez.");
                    const merged = { ...original, values: { ...r.values } , rev: original.rev + 1 };
                    const module = d.modules.find(item => item.id === merged.module)!;
                    validate(module, merged.values, d.records, merged.id);
                    d.records[index] = merged;
                  }
                },
                true, // Crear punto de recuperación antes de importar.
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
