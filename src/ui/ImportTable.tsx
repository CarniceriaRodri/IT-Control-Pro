import { useMemo, useState } from "react";
import { readSheets, type Sheet } from "../data/calc";
import {
  field, uid, validate,
  type Field, type Module, type Dataset, type Entity,
} from "../domain/model";
import { Dialog } from "./Fields";
import type { Write } from "./Admin";
import { Attachments, emptyFiles } from "./Attachments";

/**
 * Los archivos definen la estructura. Los campos existentes son opcionales:
 * se reutilizan solo cuando encajan por nombre y el contenido es compatible.
 * Nunca se exige asignar una columna a un campo previo.
 */
const norm = (v: unknown) => String(v ?? "").normalize("NFKC").trim().toLocaleLowerCase("es");
const textLike = new Set(["texto", "texto largo", "autocompletado", "teléfono", "QR", "código de barras"]);
const lists = new Set(["lista", "estado", "prioridad"]);
const isMissing = (v: unknown) => v === "" || v === null || v === undefined;

function compatible(f: Field, cells: string[]) {
  if (["identificador", "relación", "relación múltiple", "casilla", "selección múltiple"].includes(f.type))
    return false;
  const values = cells.filter(v => v.trim() !== "");
  if (f.unique || f.keyRole === "primary") {
    const keys = values.map(norm);
    if (new Set(keys).size !== keys.length) return false;
  }
  if (textLike.has(f.type)) return true;
  if (lists.has(f.type)) return new Set(values.map(norm)).size <= 250;
  if (f.type === "entero") return values.every(v => /^[-+]?\d+$/.test(v.trim()) && Number.isSafeInteger(Number(v)));
  if (f.type === "decimal") return values.every(v => v.trim() !== "" && Number.isFinite(Number(v.trim())));
  if (f.type === "fecha") return values.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()));
  if (f.type === "hora") return values.every(v => /^\d{2}:\d{2}(?::\d{2})?$/.test(v.trim()));
  if (f.type === "fecha y hora") return values.every(v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.trim()));
  if (f.type === "correo") return values.every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()));
  if (f.type === "MAC") return values.every(v => /^([\da-f]{2}[:-]){5}[\da-f]{2}$/i.test(v.trim()));
  if (f.type === "IP") return values.every(v => {
    const a = v.trim().split(".");
    return a.length === 4 && a.every(x => /^\d{1,3}$/.test(x) && Number(x) < 256);
  });
  return false;
}

export function ImportTable({
  mod, data, name, write, close, load,
}: {
  mod?: Module;
  data: Dataset;
  name?: string;
  write: Write;
  close: () => void;
  load: (hash: string) => Promise<Blob | undefined>;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [idx, choose] = useState(0);
  // "auto" is always the default. Manual mappings are optional.
  const [mapping, setMapping] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [recordIds, setRecordIds] = useState<string[]>([]);
  const [moduleId] = useState(uid);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [fillMatching, setFillMatching] = useState(false);
  const [hideUnmatched, setHideUnmatched] = useState(false);
  const [label, setLabel] = useState(name || "");
  const [error, err] = useState("");
  const [busy, work] = useState(false);
  const [files, setFiles] = useState(emptyFiles);

  const sheet = sheets[idx];
  const width = sheet ? Math.max(0, ...sheet.rows.map(row => row.length)) : 0;
  const head = Array.from({length: width}, (_, i) => sheet?.rows[0]?.[i] ?? "");
  const columnLabel = (i: number) => head[i].trim() || "Columna " + (i + 1);
  const lines = sheet?.rows.slice(1) || [];

  function select(s: Sheet) {
    const n = Math.max(0, ...s.rows.map(r => r.length));
    setMapping(Array(n).fill("auto"));
    setColumnIds(Array.from({length:n}, () => uid()));
    setRecordIds(Array.from({length:Math.max(s.rows.length - 1, 0)}, () => uid()));
    setFillMatching(false);
    setHideUnmatched(false);
  }

  const plan = useMemo(() => {
    const problems: string[] = [];
    const rows: Entity[] = [];
    const updates = new Map<string, Entity>();
    const target: Module = mod
      ? {...mod, fields: mod.fields.map(f => ({...f, options: [...f.options]}))}
      : {id:moduleId, name:label.trim(), active:true, fields:[]};
    const made: Field[] = [];
    const used = new Set<string>();
    const assigned: (Field | undefined)[] = [];
    let duplicates = 0, matchedByKey = 0, skippedByKey = 0;
    let relaxed = 0, extendedLists = 0, hidden = 0;
    if (!sheet || mapping.length !== width || columnIds.length !== width || recordIds.length !== lines.length)
      return {ready:false, target, rows, updates:[], made, assigned, problems, duplicates,
        matchedByKey, skippedByKey, relaxed, extendedLists, hidden};

    mapping.forEach((mode, i) => {
      if (mode === "omit") {
        assigned.push(undefined);
        return;
      }
      const cells = lines.map(line => line[i] ?? "");
      let existing: Field | undefined;
      if (mod && mode === "auto") {
        existing = target.fields.find(f =>
          f.visible && f.relationMode !== "off" && !used.has(f.id) &&
          (norm(f.label) === norm(columnLabel(i)) || norm(f.id) === norm(columnLabel(i))) &&
          compatible(f, cells)
        );
      } else if (mod && !["new", "auto"].includes(mode)) {
        existing = target.fields.find(f => f.id === mode && !used.has(f.id));
        if (!existing || !compatible(existing, cells))
          problems.push("Columna «" + columnLabel(i) + "»: el campo seleccionado no admite todos los valores. Usa «Automático» o «Crear nuevo».");
      }
      if (existing) {
        assigned.push(existing);
        used.add(existing.id);
      } else {
        const created = field(columnIds[i], columnLabel(i));
        made.push(created);
        assigned.push(created);
      }
    });
    if (!assigned.some(Boolean)) problems.push("El archivo debe aportar al menos una columna.");
    if (!mod && (!target.name || data.modules.some(m => norm(m.name) === norm(target.name))))
      problems.push("Indica un nombre de módulo nuevo que no esté repetido.");
    target.fields.push(...made);

    // Los valores del archivo gobiernan las opciones; nunca se rechaza un
    // estado nuevo solo porque no figure en un desplegable anterior.
    for (const f of target.fields) {
      const col = assigned.findIndex(a => a?.id === f.id);
      if (col >= 0 && lists.has(f.type)) {
        const before = f.options.length;
        for (const line of lines) {
          const raw = line[col] ?? "";
          if (raw !== "" && !f.options.includes(raw)) f.options.push(raw);
        }
        if (f.options.length !== before) extendedLists++;
      }
      if (mod && f.required && lines.some(line =>
        col < 0 || isMissing(line[col] ?? "")
      )) {
        f.required = false;
        relaxed++;
      }
      if (mod && hideUnmatched && !used.has(f.id) &&
          !made.some(created => created.id === f.id) && f.visible) {
        f.visible = false;
        // An invisible field cannot remain mandatory.
        f.required = false;
        hidden++;
      }
    }

    const signatures = new Set<string>();
    for (const row of data.records.filter(r => r.module === target.id)) {
      signatures.add(JSON.stringify(assigned.map(f => f ? String(row.values[f.id] ?? "") : null)));
    }
    const staged: Entity[] = data.records.map(r => ({...r, values:{...r.values}}));
    const primary = assigned.find(f => f?.keyRole === "primary");
    const existingById = new Map(data.records.map(r => [r.id, r]));

    for (const [i, line] of lines.entries()) {
      if (line.every(v => v.trim() === "")) continue;
      const values: Entity["values"] = {};
      assigned.forEach((f, j) => {if (f) values[f.id] = line[j] ?? "";});
      const id = recordIds[i];

      if (primary && norm(values[primary.id])) {
        const candidates = staged.filter(r =>
          r.module === target.id && !r.archived &&
          norm(r.values[primary.id]) === norm(values[primary.id])
        );
        if (candidates.length > 1) {
          problems.push("Fila " + (i + 2) + ": identificador principal ambiguo.");
          continue;
        }
        if (candidates.length === 1) {
          matchedByKey++;
          const previous = candidates[0];
          const committed = existingById.get(previous.id);
          // When the file repeats the same new identifier, do not silently
          // discard a second row. Report and allow review of the file.
          if (!committed) {
            problems.push("Fila " + (i + 2) + ": identificador repetido dentro del archivo.");
            continue;
          }
          if (!fillMatching) {
            skippedByKey++;
            continue;
          }
          const mergedValues = {...previous.values};
          let changed = false;
          for (const f of assigned) {
            if (!f) continue;
            const input = values[f.id], current = mergedValues[f.id];
            if (isMissing(current) && !isMissing(input)) {
              mergedValues[f.id] = input;
              changed = true;
            } else if (isMissing(committed.values[f.id]) && !isMissing(current) &&
                       !isMissing(input) && current !== input) {
              problems.push("Fila " + (i + 2) + ": dos valores distintos para el mismo campo de un registro coincidente.");
            }
          }
          if (changed) {
            const next: Entity = {...previous, values:mergedValues, rev:committed.rev+1};
            try {
              validate(target, next.values, staged, next.id);
              updates.set(next.id, next);
              staged[staged.findIndex(r => r.id === next.id)] = next;
            } catch(e) { problems.push("Fila " + (i + 2) + ": " + String(e)); }
          }
          continue;
        }
      }

      const signature = JSON.stringify(assigned.map(f => f ? String(values[f.id] ?? "") : null));
      if (signatures.has(signature)) {
        duplicates++;
        if (skipDuplicates) continue;
      }
      try {
        validate(target, values, staged, id);
        const row: Entity = {id, module: target.id, values, rev:1, archived:false};
        rows.push(row);
        staged.push(row);
        signatures.add(signature);
      } catch(e) {
        problems.push("Fila " + (i + 2) + ": " + String(e));
      }
    }

    return {ready:true, target, rows, updates:[...updates.values()], made, assigned,
      problems, duplicates, matchedByKey, skippedByKey, relaxed, extendedLists, hidden};
  }, [sheet, mapping, columnIds, recordIds, width, lines, moduleId, mod,
      data, label, skipDuplicates, fillMatching, hideUnmatched]);

  return <Dialog name={mod ? "Importación libre · " + mod.name : "Crear módulo desde un archivo"} close={close}>
    <div className="importBody">
      {!mod && <label>Nombre del módulo
        <input value={label} onChange={e => setLabel(e.target.value)}/>
      </label>}
      <label>Archivo CSV o LibreOffice Calc (ODS)
        <input type="file" accept=".csv,.ods" disabled={busy} onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          work(true); err(""); setSheets([]);
          try {
            const read = await readSheets(file);
            if (!read[0]?.rows.length) throw Error("La tabla está vacía.");
            setSheets(read);
            choose(0);
            select(read[0]);
            if (!label) setLabel(file.name.replace(/\.[^.]+$/, ""));
          } catch(e) {err(String(e));}
          finally {work(false);}
        }}/>
      </label>

      {sheet && <div className="importAdaptation">
        <label>Hoja
          <select value={idx} onChange={e => {
            const i = Number(e.target.value);
            choose(i);
            select(sheets[i]);
          }}>
            {sheets.map((s, i) => <option value={i} key={i}>{s.name}</option>)}
          </select>
        </label>
        <p><strong>No tienes que elegir ningún campo antiguo.</strong> Los encabezados y valores del archivo se incorporan automáticamente. Los campos que ya existían siguen disponibles.</p>
        <div className="importPlan">
          <strong>Cómo quedará el módulo</strong>
          <span>{head.length} columnas detectadas</span>
          <span>{plan.made.length} campos nuevos</span>
          <span>{plan.assigned.filter(f => !!f && !plan.made.includes(f)).length} campos existentes reutilizados cuando coinciden</span>
          <span>{plan.relaxed} campos antiguos dejan de ser obligatorios para admitir la nueva estructura</span>
          {plan.extendedLists > 0 && <span>{plan.extendedLists} listas ampliadas con valores del archivo</span>}
        </div>
        <details>
          <summary>Opciones avanzadas de columnas (opcionales)</summary>
          <p>Aquí puedes cambiar correspondencias o excluir columnas. No necesitas hacer nada para importar.</p>
          {head.map((h, i) => <label key={columnIds[i] || i}>
            {h || "Columna " + (i+1)}
            <select value={mapping[i] || "auto"} onChange={e =>
              setMapping(current => current.map((m, j) => i === j ? e.target.value : m))
            }>
              <option value="auto">Automático: aprovechar coincidencias seguras o crear campo</option>
              <option value="new">Crear siempre un campo nuevo</option>
              <option value="omit">No importar esta columna</option>
              {mod?.fields.filter(f => f.visible && !["identificador","relación","relación múltiple","casilla","selección múltiple"].includes(f.type))
                .map(f => <option key={f.id} value={f.id}>Usar campo existente: {f.label}</option>)}
            </select>
          </label>)}
        </details>
        {mod && <label className="check"><input type="checkbox" checked={hideUnmatched}
          onChange={e => setHideUnmatched(e.target.checked)}/>
          Ocultar los campos antiguos que no aparezcan en el archivo (conservar sus datos).
        </label>}
        <h3>Vista previa del archivo</h3>
        <div className="tableScroll"><table><thead><tr>
          {head.map((h,i)=><th key={i}>{h || "Columna " + (i+1)}</th>)}
        </tr></thead><tbody>{lines.slice(0,5).map((row,i)=><tr key={i}>
          {head.map((_,j)=><td key={j}>{row[j] ?? ""}</td>)}
        </tr>)}</tbody></table></div>
        <label className="check"><input type="checkbox" checked={skipDuplicates}
          onChange={e => setSkipDuplicates(e.target.checked)}/>
          Omitir filas exactamente repetidas (por defecto se conservan).
        </label>
        {mod?.fields.some(f => f.keyRole === "primary") && <label className="check">
          <input type="checkbox" checked={fillMatching} onChange={e => setFillMatching(e.target.checked)}/>
          Si coincide el identificador principal, completar solo campos vacíos del registro existente.
        </label>}
        <p><strong>{plan.rows.length} nuevos registros</strong> · {plan.updates.length} registros para completar ·
          {plan.skippedByKey} coincidencias con identificador existente sin modificar ·
          {plan.duplicates} duplicados detectados · {plan.problems.length} errores.</p>
        {plan.skippedByKey > 0 && <p>Los identificadores principales ya existentes no se duplicarán ni sobrescribirán. Puedes activar «Completar solo campos vacíos» para aprovechar datos adicionales.</p>}
        {plan.problems.slice(0,15).map((problem,i)=><small role="alert" key={i}>{problem}</small>)}
      </div>}

      {!mod && <Attachments value={files} change={setFiles} load={load} pending={work}/>}
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={busy || !plan.ready || plan.problems.length > 0 ||
        (!plan.rows.length && !plan.updates.length && !plan.made.length)} onClick={async()=>{
        if (plan.skippedByKey && !confirm("Hay " + plan.skippedByKey +
            " filas con identificador existente. Se conservarán los registros actuales sin modificarlos. ¿Continuar?"))
          return;
        work(true);
        err("");
        try {
          await write("Importación libre de tabla",plan.target.id,draft=>{
            if(!mod) draft.modules.push({...plan.target,files:files.refs});
            else {
              const previous = draft.modules.find(m=>m.id===mod.id);
              if(!previous)throw Error("Módulo no encontrado.");
              // La estructura se adapta en la misma transacción que los datos.
              previous.fields = plan.target.fields;
            }
            for (const record of plan.rows) draft.records.push(record);
            for (const record of plan.updates) {
              const i = draft.records.findIndex(r=>r.id===record.id);
              if(i<0 || draft.records[i].rev !== record.rev-1)
                throw Error("Un registro ha cambiado: vuelve a importar.");
              const found = draft.records[i];
              draft.records[i]={...record,files:found.files};
            }
          },true,files.blobs);
          close();
        }catch(e){err(String(e));}
        finally{work(false);}
      }}>Importar y adaptar el módulo</button>
    </div>
  </Dialog>;
}
