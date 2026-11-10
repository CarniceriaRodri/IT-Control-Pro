import { Attachments, type FileDraft } from "./Attachments";
import type { Binaries } from "../data/media";
import { shown } from "../domain/model";
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
  f, v, set, data, createRelated,
}: {
  f: Field;
  v: unknown;
  set: (v: unknown) => void;
  data: Dataset;
  createRelated?: (module: Module, selected: (row: Entity) => void) => void;
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
    const multi = f.type === "relación múltiple";
    const ids = multi ? (Array.isArray(v) ? v as string[] : []) : (v ? [String(v)] : []);
    const targets = data.modules.filter((m) => m.id === f.target || f.target === "*");
    const related = data.records.filter((r) => targets.some((m) => m.id === r.module));
    const optionText = (r: Entity) => {
      const m = data.modules.find((m) => m.id === r.module)!;
      return m.name + " · " + m.fields.map((f) => {
        const value = r.values[f.id];
        return Array.isArray(value) ? "" : String(value ?? "");
      }).filter(Boolean).join(" · ");
    };
    const matches = related.filter((r) => !r.archived && !ids.includes(r.id) &&
      optionText(r).toLocaleLowerCase().includes(term.toLocaleLowerCase())).slice(0, 20);
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
            <button type="button" aria-label={"Quitar relación " + r.id} onClick={() =>
              set(multi ? ids.filter((id) => id !== r.id) : "")}>×</button>
          </div>)}
        </div>
        <input
          type="search"
          aria-label={"Buscar " + f.label}
          placeholder={"Buscar en " + (f.target === "*" ? "todos los módulos" : targets[0]?.name || "módulo") + "…"}
          value={term}
          onChange={(e) => { search(e.target.value); expand(true); }}
          onFocus={() => expand(true)}
          onBlur={() => setTimeout(() => expand(false), 180)}
        />
        {expanded && (
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
        {createRelated && targets.filter((m) => m.active).length > 0 && (
          <div className="relationCreate">
            {targets.filter((m) => m.active).map((m) => (
              <button type="button" key={m.id}
                onClick={() => createRelated(m, (r) => choose(r.id))}>
                + Nuevo en {m.name}
              </button>
            ))}
          </div>
        )}
        {f.required && !ids.length && <span className="hint">Selecciona al menos un registro</span>}
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
  const html: Record<string, string> = {
    entero: "number", decimal: "number", fecha: "date", hora: "time",
    "fecha y hora": "datetime-local", correo: "email", teléfono: "tel",
  };
  return (
    <>
      <input {...props} type={html[f.type] || "text"}
        readOnly={f.type === "identificador"}
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
}: {
  mod: Module;
  row?: Entity;
  data: Dataset;
  load: (hash: string) => Promise<Blob | undefined>;
  save: (row: Entity, files: Binaries) => Promise<void>;
  close: () => void;
  createRelated?: (module: Module, selected: (row: Entity) => void) => void;
}) {
  const [files, attach] = useState<FileDraft>(() => ({
    refs: row?.files || [],
    blobs: new Map(),
  }));
  const [busy, work] = useState(false);
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
          archived: false,
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
  for (const f of mod.fields.filter((f) => shown(f, values))) {
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
                />
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </fieldset>
        ))}
        {row && (() => {
          const links = data.records.filter((r) => !r.archived && r.id !== row.id &&
            data.modules.some((m) => m.id === r.module && m.fields.some((f) =>
              (f.type === "relación" || f.type === "relación múltiple") &&
              (f.target === mod.id || f.target === "*") &&
              (Array.isArray(r.values[f.id]) ? r.values[f.id].includes(row.id) : r.values[f.id] === row.id)
            )));
          return links.length > 0 ? <section className="relatedBacklinks">
            <h3>Relacionado desde otros módulos ({links.length})</h3>
            {links.map((r) => {
              const m = data.modules.find((m) => m.id === r.module)!;
              return <p key={r.id}>{m.name} · {title(r, m)}</p>;
            })}
          </section> : null;
        })()}
        <Attachments value={files} change={attach} load={load} pending={work} />
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          Guardar registro
        </button>
      </form>
    </Dialog>
  );
}
