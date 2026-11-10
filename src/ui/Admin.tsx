import { useState } from "react";
import {
  field,
  types,
  uid,
  type Dataset,
  type Field,
  type Module,
} from "../domain/model";
import { envelope, parseBackup } from "../data/backup";
import { Dialog } from "./Fields";
export type Write = (
  action: string,
  target: string,
  fn: (d: Dataset) => void,
  checkpoint?: boolean,
) => Promise<void>;
export function Admin({
  data,
  write,
  recovery,
}: {
  data: Dataset;
  write: Write;
  recovery: () => Promise<Dataset | undefined>;
}) {
  const [mid, select] = useState(data.modules[0].id),
    [name, setName] = useState(""),
    [draft, edit] = useState<Field | null>(null),
    [preview, stage] = useState<Dataset | null>(null),
    [message, msg] = useState("");
  const mod = data.modules.find((m) => m.id === mid) || data.modules[0];
  async function run(fn: () => Promise<void>) {
    try {
      msg("");
      await fn();
    } catch (e) {
      msg(String(e));
    }
  }
  function update(fields: Field[]) {
    return write("Configurar formulario", mod.id, (d) => {
      d.modules.find((m) => m.id === mod.id)!.fields = fields;
    });
  }
  function download() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(envelope(data), null, 2)], {
        type: "application/json",
      }),
    );
    link.download = "it-control-pro-v2.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }
  return (
    <div className="admin">
      <section>
        <h2>Módulos y formularios</h2>
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const label = name.trim();
              if (
                !label ||
                data.modules.some(
                  (m) => m.name.toLowerCase() === label.toLowerCase(),
                )
              )
                throw Error("Nombre vacío o duplicado");
              const id = uid();
              const m: Module = {
                id,
                name: label,
                active: true,
                fields: [{ ...field("nombre", "Nombre"), required: true }],
              };
              await write("Crear módulo", id, (d) => {
                d.modules.push(m);
              });
              select(id);
              setName("");
            });
          }}
        >
          <input
            aria-label="Nombre del módulo nuevo"
            placeholder="Nombre del módulo nuevo"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />
          <button>Crear módulo</button>
        </form>
        <label>
          Módulo que quieres configurar
          <select value={mod.id} onChange={(e) => select(e.target.value)}>
            {data.modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={mod.active}
            onChange={() =>
              void run(() =>
                write("Activación del módulo", mod.id, (d) => {
                  d.modules.find((m) => m.id === mod.id)!.active = !mod.active;
                }),
              )
            }
          />{" "}
          Módulo activo
        </label>
        {mod.fields.map((f, i) => (
          <div className="fieldRow" key={f.id}>
            <div>
              <strong>{f.label}</strong>
              <small>
                {f.type} · {f.visible ? "Visible" : "Oculto"}
              </small>
            </div>
            <button
              aria-label={"Subir " + f.label}
              disabled={!i}
              onClick={() => {
                const a = [...mod.fields];
                [a[i], a[i - 1]] = [a[i - 1], a[i]];
                void run(() => update(a));
              }}
            >
              ↑
            </button>
            <button onClick={() => edit({ ...f })}>Editar</button>
          </div>
        ))}
        <button className="primary" onClick={() => edit(field(uid(), ""))}>
          Añadir campo
        </button>
      </section>
      <section>
        <h2>Copias y restauración</h2>
        <p>
          Los datos se guardan en este navegador. Quien acceda a este perfil
          podrá consultarlos y modificarlos.
        </p>
        <div className="inline">
          <button onClick={download}>Exportar JSON</button>
          <label className="fileBtn">
            Importar JSON
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void run(async () => stage(parseBackup(await file.text())));
              }}
            />
          </label>
          <button
            onClick={() =>
              void run(async () => {
                const d = await recovery();
                if (d) stage(d);
                else msg("Todavía no hay una restauración anterior.");
              })
            }
          >
            Recuperar copia anterior
          </button>
        </div>
      </section>
      <section>
        <h2>Auditoría local</h2>
        {data.history.length === 0 ? (
          <p>Sin operaciones registradas.</p>
        ) : (
          data.history
            .slice(-30)
            .reverse()
            .map((h) => (
              <div key={h.id} className="audit">
                {h.action}
                <small>
                  {new Date(h.at).toLocaleString("es-ES")} · {h.target}
                </small>
              </div>
            ))
        )}
      </section>
      {message && <p role="status">{message}</p>}
      {preview && (
        <Dialog name="Revisar restauración" close={() => stage(null)}>
          <p>
            La copia contiene {preview.modules.length} módulos y{" "}
            {preview.records.length} registros. Sustituirá los{" "}
            {data.records.length} registros actuales. Podrás recuperar la
            versión anterior.
          </p>
          <button
            className="primary"
            onClick={() =>
              void run(async () => {
                await write(
                  "Restaurar copia",
                  "workspace",
                  (d) => Object.assign(d, preview),
                  true,
                );
                stage(null);
                msg("Copia restaurada.");
              })
            }
          >
            Confirmar restauración
          </button>
        </Dialog>
      )}
      {draft && (
        <Dialog name="Configurar campo" close={() => edit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const f = {
                  ...draft,
                  label: draft.label.trim(),
                  options: [
                    ...new Set(
                      draft.options.map((s) => s.trim()).filter(Boolean),
                    ),
                  ],
                };
                if (!f.label) throw Error("Indica un nombre");
                await update(
                  mod.fields.some((x) => x.id === f.id)
                    ? mod.fields.map((x) => (x.id === f.id ? f : x))
                    : [...mod.fields, f],
                );
                edit(null);
              });
            }}
          >
            <label>
              Nombre del campo
              <input
                required
                value={draft.label}
                onChange={(e) => edit({ ...draft, label: e.target.value })}
              />
            </label>
            <label>
              Tipo
              <select
                disabled={mod.fields.some((f) => f.id === draft.id)}
                value={draft.type}
                onChange={(e) =>
                  edit({
                    ...draft,
                    type: e.target.value as Field["type"],
                    target: mod.id,
                  })
                }
              >
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Descripción
              <input
                value={draft.hint || ""}
                onChange={(e) => edit({ ...draft, hint: e.target.value })}
              />
            </label>
            {[
              "lista",
              "selección múltiple",
              "estado",
              "prioridad",
              "autocompletado",
            ].includes(draft.type) && (
              <label>
                Opciones, una por línea
                <textarea
                  required
                  value={draft.options.join("\n")}
                  onChange={(e) =>
                    edit({ ...draft, options: e.target.value.split("\n") })
                  }
                />
              </label>
            )}
            {draft.type === "relación" ? (
              <label>
                Módulo relacionado
                <select
                  value={draft.target}
                  disabled={mod.fields.some((f) => f.id === draft.id)}
                  onChange={(e) => edit({ ...draft, target: e.target.value })}
                >
                  {data.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Valor inicial
                <input
                  value={draft.initial || ""}
                  onChange={(e) => edit({ ...draft, initial: e.target.value })}
                />
              </label>
            )}
            {(
              [
                ["required", "Obligatorio"],
                ["visible", "Visible"],
                ["unique", "Evitar duplicados"],
              ] as const
            ).map(([k, l]) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={!!draft[k]}
                  onChange={(e) => edit({ ...draft, [k]: e.target.checked })}
                />
                {l}
              </label>
            ))}
            <label>
              Sección del formulario
              <input
                value={draft.section || ""}
                onChange={(e) => edit({ ...draft, section: e.target.value })}
              />
            </label>
            <label>
              Mostrar según otro campo
              <select
                value={draft.when?.field || ""}
                onChange={(e) =>
                  edit({
                    ...draft,
                    when: e.target.value
                      ? { field: e.target.value, equals: "" }
                      : undefined,
                  })
                }
              >
                <option value="">Siempre</option>
                {mod.fields
                  .filter((f) => f.id !== draft.id && !f.when && f.visible)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
              </select>
            </label>
            {draft.when && (
              <label>
                Mostrar cuando el valor sea
                <input
                  required
                  value={draft.when.equals}
                  onChange={(e) =>
                    edit({
                      ...draft,
                      when: {
                        field: draft.when!.field,
                        equals: e.target.value,
                      },
                    })
                  }
                />
              </label>
            )}
            {message && <p role="alert">{message}</p>}
            <button className="primary">Guardar campo</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
