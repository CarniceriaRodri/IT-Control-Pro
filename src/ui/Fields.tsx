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
  f,
  v,
  set,
  data,
}: {
  f: Field;
  v: unknown;
  set: (v: unknown) => void;
  data: Dataset;
}) {
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
      <input
        type="checkbox"
        checked={v === true || v === "true"}
        onChange={(e) => set(e.target.checked)}
      />
    );
  if (f.type === "relación") {
    const target = data.modules.find((m) => m.id === f.target)!;
    return (
      <select {...props}>
        <option value="">Seleccionar</option>
        {data.records
          .filter((r) => r.module === f.target && (!r.archived || r.id === v))
          .map((r) => (
            <option key={r.id} value={r.id}>
              {title(r, target)}
            </option>
          ))}
      </select>
    );
  }
  if (f.type === "selección múltiple")
    return (
      <select
        multiple
        required={f.required}
        value={Array.isArray(v) ? v : []}
        onChange={(e) =>
          set(Array.from(e.target.selectedOptions, (o) => o.value))
        }
      >
        {f.options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    );
  if (["lista", "estado", "prioridad"].includes(f.type))
    return (
      <select {...props}>
        <option value="">Seleccionar</option>
        {f.options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    );
  const html: Record<string, string> = {
    entero: "number",
    decimal: "number",
    fecha: "date",
    hora: "time",
    "fecha y hora": "datetime-local",
    correo: "email",
    teléfono: "tel",
  };
  return (
    <>
      <input
        {...props}
        type={html[f.type] || "text"}
        readOnly={f.type === "identificador"}
        step={f.type === "decimal" ? "any" : undefined}
        list={f.type === "autocompletado" ? f.id : undefined}
      />
      {f.type === "autocompletado" && (
        <datalist id={f.id}>
          {f.options.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </datalist>
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
}: {
  mod: Module;
  row?: Entity;
  data: Dataset;
  load: (hash: string) => Promise<Blob | undefined>;
  save: (row: Entity, files: Binaries) => Promise<void>;
  close: () => void;
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
                />
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </fieldset>
        ))}
        <Attachments value={files} change={attach} load={load} pending={work} />
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          Guardar registro
        </button>
      </form>
    </Dialog>
  );
}
