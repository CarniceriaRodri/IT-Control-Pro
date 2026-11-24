import { Attachments, type FileDraft } from "./Attachments";
import type { Binaries } from "../data/media";
import { shown } from "../domain/model";
import { parseTaskPaste, taskPasteFields } from "./TaskPaste";
import {
  type Dataset,
  type Module,
  type Entity,
  type Field,
  title,
  uid,
} from "../domain/model";
import {
  useState,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
export function Dialog({
  name,
  close,
  children,
}: {
  name: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={close}>
      <div className="dialogTop">
        <h2>{name}</h2>
        <button aria-label="Cerrar" onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Control({
  f, v, set, data, createRelated, openRelated,
}: {
  f: Field;
  v: unknown;
  set: (v: unknown) => void;
  data: Dataset;
  createRelated?: (module: Module, selected: (row: Entity) => void) => void;
  openRelated?: (row: Entity) => void;
}) {
  const [term, search] = useState("");
  const [expanded, expand] = useState(false);
  const props = {
    required: f.required,
    value: String(v ?? ""),
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => set(e.target.value),
  };
  if (f.type === "texto largo") return <textarea {...props} />;
  if (f.type === "casilla")
    return (
      <input type="checkbox" checked={v === true || v === "true"}
        onChange={(e) => set(e.target.checked)} />
    );
  if (f.type === "relación" || f.type === "relación múltiple") {
    const mode = f.relationMode || "full";
    const readonly = mode === "read";
    const multi = f.type === "relación múltiple";
    const ids = multi ? (Array.isArray(v) ? v as string[] : []) : (v ? [String(v)] : []);
    const targets = data.modules.filter((m) => m.id === f.target || f.target === "*");
    const related = data.records.filter((r) => targets.some((m) => m.id === r.module));
    const optionText = (r: Entity) => {
      const m = data.modules.find((item) => item.id === r.module)!;
      return m.name + " · " + title(r, m);
    };
    const searchText = (r: Entity) => {
      const m = data.modules.find((item) => item.id === r.module)!;
      return m.fields
        .filter((item) => item.type !== "identificador")
        .map((item) => r.values[item.id])
        .filter((value) => typeof value === "string" || typeof value === "number")
        .join(" ");
    };
    const matches = related.filter((r) => !r.archived && !ids.includes(r.id) &&
      (optionText(r) + " " + searchText(r)).toLocaleLowerCase().includes(term.toLocaleLowerCase())).slice(0, 20);
    const chosen = ids.map((id) => related.find((r) => r.id === id)).filter((r): r is Entity => !!r);
    function choose(id: string) {
      set(multi ? [...ids, id] : id);
      search("");
      expand(false);
    }
    return (
      <div className="relationPicker">
        <div className="relationChosen">
          {chosen.map((r) => <div className="relationChip" key={r.id}>
            <span>{optionText(r)}{r.archived ? " (archivado)" : ""}</span>
            {openRelated && <button type="button" onClick={() => openRelated(r)}>Abrir</button>}
            {!readonly && <button type="button" aria-label={"Quitar relación " + r.id} onClick={() =>
              set(multi ? ids.filter((id) => id !== r.id) : "")}>×</button>}
          </div>)}
        </div>
        {!readonly && <input
          type="search"
          aria-label={"Buscar " + f.label}
          placeholder={"Buscar en " + (f.target === "*" ? "todos los módulos" : targets[0]?.name || "módulo") + "…"}
          value={term}
          onChange={(e) => { search(e.target.value); expand(true); }}
          onFocus={() => expand(true)}
          onBlur={() => setTimeout(() => expand(false), 180)}
        />}
        {!readonly && expanded && (
          <div className="relationOptions" role="listbox" aria-label={"Resultados " + f.label}>
            {matches.length ? matches.map((r) => (
              <button type="button" role="option" aria-selected={false}
                key={r.id} onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r.id)}>
                {optionText(r)}
              </button>
            )) : <p>Sin resultados. Puedes crear el registro desde aquí.</p>}
          </div>
        )}
        {mode === "full" && createRelated && targets.filter((m) => m.active).length > 0 && (
          targets.filter((m) => m.active).length > 3 ? (
            <div className="relationCreate">
              <select aria-label={"Crear registro relacionado para " + f.label} value=""
                onChange={(e) => {
                  const selected = targets.find((m) => m.id === e.target.value && m.active);
                  if (selected) createRelated(selected, (r) => choose(r.id));
                }}>
                <option value="">+ Crear registro en módulo…</option>
                {targets.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="relationCreate">
              {targets.filter((m) => m.active).map((m) => (
                <button type="button" key={m.id}
                  onClick={() => createRelated(m, (r) => choose(r.id))}>
                  + Nuevo en {m.name}
                </button>
              ))}
            </div>
          )
        )}
        {f.required && !ids.length && !readonly && <span className="hint">Selecciona al menos un registro</span>}
      </div>
    );
  }
  if (f.type === "selección múltiple")
    return (
      <select multiple required={f.required} value={Array.isArray(v) ? v : []}
        onChange={(e) => set(Array.from(e.target.selectedOptions, (o) => o.value))}>
        {f.options.map((x) => <option key={x}>{x}</option>)}
      </select>
    );
  if (["lista", "estado", "prioridad"].includes(f.type))
    return (
      <select {...props}>
        <option value="">Seleccionar</option>
        {f.options.map((x) => <option key={x}>{x}</option>)}
      </select>
    );
  if (f.type === "identificador") {
    return <input type="text" value="Asignado automáticamente" readOnly aria-label={f.label + " asignado automáticamente"} />;
  }
  const html: Record<string, string> = {
    entero: "number", decimal: "number", fecha: "date", hora: "time",
    "fecha y hora": "datetime-local", correo: "email", teléfono: "tel",
  };
  return (
    <>
      <input {...props} type={html[f.type] || "text"}
        step={f.type === "decimal" ? "any" : undefined}
        list={f.type === "autocompletado" ? f.id : undefined} />
      {f.type === "autocompletado" && (
        <datalist id={f.id}>{f.options.map((x) => <option key={x}>{x}</option>)}</datalist>
      )}
    </>
  );
}
export function Editor({
  mod,
  row,
  load,
  data,
  save,
  close,
  createRelated,
  openRelated,
}: {
  mod: Module;
  row?: Entity;
  data: Dataset;
  load: (hash: string) => Promise<Blob | undefined>;
  save: (row: Entity, files: Binaries) => Promise<void>;
  close: () => void;
  createRelated?: (module: Module, selected: (row: Entity) => void) => void;
  openRelated?: (row: Entity) => void;
}) {
  const [files, attach] = useState<FileDraft>(() => ({
    refs: row?.files || [],
    blobs: new Map(),
  }));
  const [busy, work] = useState(false);
  const [editHidden, showHidden] = useState(false);
  const [id] = useState(() => row?.id || uid());
  const [values, set] = useState<Entity["values"]>(() => ({
    ...Object.fromEntries(
      mod.fields
        .filter((f) => f.visible)
        .map((f) => [
          f.id,
          f.type === "identificador"
            ? id
            : f.type === "selección múltiple"
              ? []
              : f.type === "relación múltiple"
                ? []
                : f.type === "casilla"
                ? f.initial === "true"
                : f.initial || "",
        ]),
    ),
    ...row?.values,
  }));
  const [error, err] = useState("");
  const [taskPaste, setTaskPaste] = useState("");
  const [taskPreview, setTaskPreview] = useState<Record<string, string> | null>(null);
  const taskFields = mod.id === "Tareas"
    ? [...mod.fields, ...taskPasteFields.filter(f => !mod.fields.some(existing => existing.id === f.id))]
    : mod.fields;
  const duplicateTask = mod.id === "Tareas" && taskPreview?.referencia
    ? data.records.find(r => r.module === "Tareas" && !r.archived
      && String(r.values.referencia || "").toUpperCase() === taskPreview.referencia!.toUpperCase()
      && r.id !== row?.id)
    : undefined;
  function applyTaskPaste() {
    if (!taskPreview?.referencia) { err("No se ha detectado un identificador de tarea válido."); return; }
    if (duplicateTask) { err("Esta tarea ya está registrada. Abre su registro para actualizarla."); return; }
    set(current => {
      const result = {...current};
      for(const [key, value] of Object.entries(taskPreview)){
        if(!value || (key === "estado" && !mod.fields.some(f => f.id === "estado")))continue;
        // No reemplazar el contenido existente sin revisión explícita.
        if(!String(result[key] ?? "").trim())result[key]=value;
      }
      return result;
    });
    err("");
    setTaskPreview(null);
    setTaskPaste("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    work(true);
    try {
      await save(
        {
          files: files.refs,
          id,
          module: mod.id,
          values,
          archived: row?.archived || false,
          rev: (row?.rev || 0) + 1,
        },
        files.blobs,
      );
      close();
    } catch (e) {
      err(String(e));
    } finally {
      work(false);
    }
  }
  const grouped = new Map<string, Field[]>();
  // Los campos ocultos con datos anteriores se pueden consultar y editar
  // bajo petición. No se pierde su contenido cuando otro archivo cambia el módulo.
  const visibleFields = taskFields.filter(f => shown(f, values));
  const hiddenFields = taskFields.filter(f => !shown(f, values));
  for (const f of visibleFields) {
    const section = f.section || "";
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(f);
  }
  const groups = Array.from(grouped);
  return (
    <Dialog
      name={(row ? "Editar" : "Nuevo registro") + " · " + mod.name}
      close={close}
    >
      <form onSubmit={submit}>
        {mod.id === "Tareas" && <section className="fieldRow">
          <h3>Importar tarea desde CA_SIS / Jira</h3>
          <p>Pega la ficha copiada; se analizará localmente. Revisa los campos antes de aplicarlos. No se modifica CA_SIS.</p>
          <textarea aria-label="Texto de tarea copiado de CA_SIS" rows={6}
            value={taskPaste} onChange={e => {setTaskPaste(e.target.value); setTaskPreview(null);}} />
          <button type="button" onClick={()=>{setTaskPreview(parseTaskPaste(taskPaste));err("");}}
            disabled={!taskPaste.trim()}>Analizar texto pegado</button>
          {taskPreview && <div>
            <h4>Vista previa de campos detectados</h4>
            {Object.entries(taskPreview).map(([key,value])=><p key={key}>
              <strong>{taskPasteFields.find(f=>f.id===key)?.label || mod.fields.find(f=>f.id===key)?.label || key}:</strong>{" "}
              {value.length > 200 ? value.slice(0,200)+"…" : value}
            </p>)}
            {duplicateTask && <p role="alert">Ya existe esa referencia: no se creará una tarea duplicada.</p>}
            <button type="button" disabled={!taskPreview.referencia || !!duplicateTask}
              onClick={applyTaskPaste}>Aplicar campos detectados (solo vacíos)</button>
          </div>}
        </section>}
        {row && <div className="fieldRow">
          <strong>Registro existente · todos los campos pueden editarse</strong>
          <span>{row.archived ? "Archivado" : "Activo"}</span>
        </div>}
        {groups.map(([section, fields]) => (
          <fieldset key={section}>
            {section && <legend>{section}</legend>}
            {fields.map((f) => (
              <label key={f.id}>
                {f.label}
                {f.required ? " *" : ""}
                <Control
                  f={f}
                  v={values[f.id]}
                  set={(v) => set({ ...values, [f.id]: v })}
                  data={data}
                  createRelated={createRelated}
                  openRelated={openRelated}
                />
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </fieldset>
        ))}
        {hiddenFields.length > 0 && <section className="hiddenFieldsEditor">
          <label className="check">
            <input type="checkbox" checked={editHidden}
              onChange={e=>showHidden(e.target.checked)}/>
            Mostrar y editar campos ocultos o condicionales ({hiddenFields.length})
          </label>
          {editHidden && <fieldset>
            <legend>Campos ocultos / anteriores</legend>
            <p>Los valores se conservan aunque el campo no se muestre en la tabla.
              Si vuelves a mostrar el campo desde Administración, aparecerá normalmente.</p>
            {hiddenFields.map(f=><label key={f.id}>
              {f.label} · {f.type}
              <Control f={f} v={values[f.id]}
                set={v=>set(before=>({...before,[f.id]:v}))}
                data={data}
                createRelated={createRelated}
                openRelated={openRelated}/>
              {f.hint && <small>{f.hint}</small>}
            </label>)}
          </fieldset>}
        </section>}
        {row && (() => {
          const links = data.records.filter((r) => !r.archived && r.id !== row.id &&
            data.modules.some((m) => m.id === r.module && m.fields.some((f) =>
              (f.type === "relación" || f.type === "relación múltiple") &&
              (f.target === mod.id || f.target === "*") &&
              (Array.isArray(r.values[f.id]) ? (r.values[f.id] as unknown[]).includes(row.id) : r.values[f.id] === row.id)
            )));
          return links.length > 0 ? <section className="relatedBacklinks">
            <h3>Relacionado desde otros módulos ({links.length})</h3>
            {links.map((r) => {
              const m = data.modules.find((m) => m.id === r.module)!;
              return <div className="relationBacklink" key={r.id}><span>{m.name} · {title(r, m)}</span>{openRelated && <button type="button" onClick={() => openRelated(r)}>Abrir</button>}</div>;
            })}
          </section> : null;
        })()}
        <Attachments value={files} change={attach} load={load} pending={work} library={[...data.modules, ...data.records].flatMap((item) => item.files || [])} />
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          Guardar registro
        </button>
      </form>
    </Dialog>
  );
}
