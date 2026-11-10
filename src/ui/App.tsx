import { ModuleTools } from "./ModuleTools";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileText,
  HardDrive,
  Layers3,
  LayoutDashboard,
  Menu,
  Monitor,
  Network,
  Plus,
  Search,
  Settings2,
  SunMoon,
  Ticket,
  Warehouse,
} from "lucide-react";
import { type Entity, type Module, title } from "../domain/model";
import { type Repository, type Snapshot, putRecord } from "../data/repository";
import { Admin, type Write } from "./Admin";
import { Dialog, Editor } from "./Fields";
import { install, statusPwa, activateUpdate } from "../pwa";
const icons: Record<string, typeof Monitor> = {
  Panel: LayoutDashboard,
  Centros: Building2,
  Inventario: Monitor,
  Almacén: Warehouse,
  Incidencias: Ticket,
  Redes: Network,
  Agenda: CalendarDays,
  Documentación: FileText,
  Informes: ChartNoAxesColumn,
  Administración: Settings2,
};
const descriptions: Record<string, string> = {
  Centros: "Directorio de centros y ubicaciones",
  Inventario: "Equipos, modelos y números de serie",
  Incidencias: "Seguimiento de avisos y prioridades",
  Almacén: "Artículos y cantidades registradas",
  Redes: "Dispositivos y direcciones IP",
  Agenda: "Tareas, fechas y estados",
  Documentación: "Referencias y documentación técnica",
};
const Icon = ({ id, size = 19 }: { id: string; size?: number }) => {
  const Glyph = icons[id] || Layers3;
  return <Glyph size={size} strokeWidth={1.7} />;
};
export function App({
  repo,
  initial,
}: {
  repo: Repository;
  initial: Snapshot;
}) {
  const [snap, state] = useState(initial),
    [page, nav] = useState("Panel"),
    [menu, toggle] = useState(false),
    [query, search] = useState(""),
    [sort, order] = useState(false),
    [arch, archives] = useState(false),
    [editor, edit] = useState<Entity | "new" | null>(null),
    [info, notify] = useState(""),
    [diag, diagnose] = useState(false),
    [, refresh] = useState(0);
  const data = snap.data,
    mods = data.modules.filter((m) => m.active),
    mod = mods.find((m) => m.id === page);
  const active = data.records.filter((r) => !r.archived),
    count = (id: string) => active.filter((r) => r.module === id).length;
  useEffect(() => {
    const cb = () => refresh((x) => x + 1);
    window.addEventListener("pwa-status", cb);
    return () => window.removeEventListener("pwa-status", cb);
  }, []);
  useEffect(() => {
    const tick = () => {
      if (!document.hidden)
        repo
          .tick()
          .catch((e) => notify("No se pudo crear la copia: " + String(e)));
    };
    tick();
    const timer = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [repo]);
  const go = (id: string) => {
    nav(id);
    toggle(false);
    edit(null);
    search("");
    archives(false);
    order(false);
    window.scrollTo(0, 0);
  };
  const write: Write = async (a, t, fn, checkpoint, files) => {
    await repo.commit(snap.version, a, t, fn, checkpoint, files);
    state(await repo.read());
  };
  const button = (id: string, label = id) => (
    <button
      key={id}
      className={page === id ? "selected" : ""}
      onClick={() => go(id)}
    >
      <Icon id={id} />
      {label}
    </button>
  );
  const heading = mod?.name || page;
  const display = (m: Module, r: Entity, k: string) => {
    const f = m.fields.find((f) => f.id === k),
      v = r.values[k];
    if (f?.type === "relación") {
      const linked = data.records.find((r) => r.id === v),
        other = data.modules.find((m) => m.id === f.target);
      if (linked && other) return title(linked, other);
    }
    return Array.isArray(v)
      ? v.join(", ")
      : typeof v === "boolean"
        ? v
          ? "Sí"
          : "No"
        : String(v ?? "");
  };
  const rows = mod
    ? data.records.filter(
        (r) =>
          r.module === page &&
          r.archived === arch &&
          mod.fields
            .filter((f) => f.visible)
            .some((f) =>
              display(mod, r, f.id)
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
            ),
      )
    : [];
  if (mod && sort)
    rows.sort((a, b) =>
      title(a, mod).localeCompare(title(b, mod), "es", { numeric: true }),
    );
  return (
    <div className="shell">
      <aside className={menu ? "open" : ""}>
        <div className="brand">
          <b>
            <Layers3 />
          </b>{" "}
          IT Control <em>Pro</em>
        </div>
        <div className="navLabel">ESPACIO DE TRABAJO</div>
        <nav>
          {button("Panel", "Panel principal")}
          {mods.map((m) => button(m.id, m.name))}
        </nav>
        <div className="navLabel">GESTIÓN</div>
        <nav>
          {button("Informes")}
          {button("Administración")}
        </nav>
        <div className="asideFoot">
          <Database size={16} /> Almacenamiento local
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Cerrar menú"
          onClick={() => toggle(false)}
        />
      )}
      <main>
        <header>
          <div className="crumb">
            <button
              className="hamb"
              aria-label="Ver módulos"
              onClick={() => toggle(!menu)}
            >
              <Menu />
            </button>
            <Layers3 size={17} /> Espacio de trabajo <ChevronRight size={14} />
            <strong>{mod?.name || page}</strong>
          </div>
          <div className="inline">
            <button
              aria-label="Cambiar tema"
              onClick={() => {
                const dark = document.documentElement.dataset.theme !== "dark";
                document.documentElement.dataset.theme = dark
                  ? "dark"
                  : "light";
                localStorage.setItem("it-theme", dark ? "dark" : "light");
              }}
            >
              <SunMoon size={18} />
            </button>
            <button
              onClick={async () => {
                await install();
                diagnose(true);
              }}
            >
              <Download size={16} />
              <span>Instalar</span>
            </button>
          </div>
        </header>
        <article>
          <div className="title">
            <div>
              <h1>{page === "Panel" ? "Panel principal" : heading}</h1>
              <p>
                {page === "Panel"
                  ? "Vista general de la actividad informática."
                  : descriptions[page] ||
                    (
                      {
                        Informes: "Recuento de registros activos por módulo.",
                        Administración:
                          "Configura tu espacio de trabajo y protege tus datos.",
                      } as Record<string, string>
                    )[page]}
              </p>
            </div>
            {mod && !arch && (
              <button className="primary" onClick={() => edit("new")}>
                <Plus size={18} /> Nuevo registro
              </button>
            )}
          </div>
          {page === "Panel" && (
            <>
              <div className="stats">
                {[
                  ["Activos inventariados", "Inventario", Monitor],
                  ["Centros registrados", "Centros", Building2],
                  ["Incidencias registradas", "Incidencias", ClipboardList],
                ]
                  .filter(([, id]) => mods.some((m) => m.id === id))
                  .map(([label, id, G]) => {
                    const Glyph = G as typeof Monitor;
                    return (
                      <button key={String(id)} onClick={() => go(String(id))}>
                        <div>
                          <span>{String(label)}</span>
                          <Glyph size={20} />
                        </div>
                        <strong>{count(String(id))}</strong>
                      </button>
                    );
                  })}
              </div>
              <h2 className="sectionTitle">
                <Boxes size={20} /> Módulos de trabajo
              </h2>
              <div className="cards">
                {mods.map((m) => (
                  <button key={m.id} onClick={() => go(m.id)}>
                    <div className="tileIcon">
                      <Icon id={m.id} size={22} />
                    </div>
                    <ArrowUpRight className="arrow" size={16} />
                    <h3>{m.name}</h3>
                    <p>
                      {descriptions[m.id] ||
                        "Registros del módulo personalizado"}
                    </p>
                    <small>{count(m.id)} registros</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {page === "Informes" && (
            <section>
              {mods.map((m) => (
                <div className="fieldRow" key={m.id}>
                  <Icon id={m.id} />
                  <strong>{m.name}</strong>
                  <b>{count(m.id)}</b>
                </div>
              ))}
            </section>
          )}
          {page === "Administración" && (
            <Admin
              data={data}
              write={write}
              repo={repo}
              recovery={repo.recovery}
            />
          )}
          {mod && (
            <section>
              <ModuleTools
                key={mod.id}
                mod={mod}
                data={data}
                write={write}
                repo={repo}
              />
              <div className="tools">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar registros"
                    list="matches"
                    placeholder="Buscar mientras escribes…"
                    value={query}
                    onChange={(e) => search(e.target.value)}
                  />
                </label>
                <datalist id="matches">
                  {query &&
                    rows
                      .slice(0, 12)
                      .map((r) => <option key={r.id} value={title(r, mod)} />)}
                </datalist>
                <button onClick={() => order(!sort)}>
                  {sort ? "Orden original" : "Ordenar A–Z"}
                </button>
                <button aria-pressed={arch} onClick={() => archives(!arch)}>
                  {arch ? "Ver activos" : "Ver archivados"}
                </button>
              </div>
              <div className="tableScroll">
                <table>
                  <thead>
                    <tr>
                      {mod.fields
                        .filter((f) => f.visible)
                        .map((f) => (
                          <th key={f.id}>{f.label}</th>
                        ))}
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        {mod.fields
                          .filter((f) => f.visible)
                          .map((f) => (
                            <td key={f.id}>{display(mod, r, f.id) || "—"}</td>
                          ))}
                        <td>
                          <div className="inline">
                            {!arch && (
                              <button onClick={() => edit(r)}>Editar</button>
                            )}
                            <button
                              onClick={async () => {
                                if (
                                  !confirm(
                                    (arch ? "¿Reactivar" : "¿Archivar") +
                                      " este registro?",
                                  )
                                )
                                  return;
                                try {
                                  await write(
                                    arch ? "Reactivar" : "Archivar",
                                    r.id,
                                    (d) => putRecordArchive(d, r, arch),
                                  );
                                } catch (e) {
                                  notify(String(e));
                                }
                              }}
                            >
                              {arch ? "Reactivar" : "Archivar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <div className="empty">
                  <HardDrive />
                  <h3>
                    {query
                      ? "Sin coincidencias"
                      : "Sin registros " + (arch ? "archivados" : "activos")}
                  </h3>
                  <p>
                    {query
                      ? "Prueba con otra búsqueda."
                      : arch
                        ? "Aquí aparecerán las bajas lógicas."
                        : "Usa «Nuevo registro» para añadir el primero."}
                  </p>
                </div>
              )}
            </section>
          )}
        </article>
      </main>
      <div className="bottom">
        {button("Panel")}
        {mods.some((m) => m.id === "Inventario") && button("Inventario")}
        <button onClick={() => toggle(!menu)}>
          <Menu size={19} />
          Módulos
        </button>
        {button("Administración", "Ajustes")}
      </div>
      {editor && mod && (
        <Editor
          data={data}
          mod={mod}
          row={editor === "new" ? undefined : editor}
          close={() => edit(null)}
          load={repo.file}
          save={(r, files) =>
            write(
              editor === "new" ? "Alta" : "Edición",
              r.id,
              (d) => putRecord(d, mod, r),
              false,
              files,
            )
          }
        />
      )}
      {diag && (
        <Dialog name="Instalación y conexión" close={() => diagnose(false)}>
          <p>{statusPwa()}</p>
          <p>
            En Chrome para Android abre ⋮ y elige «Instalar aplicación» o
            «Añadir a pantalla de inicio». En Windows, busca el icono de
            instalación de Chrome o el menú de aplicaciones de Edge.
          </p>
          {navigator.serviceWorker?.controller && (
            <p>La caché local está activa.</p>
          )}
          {hasUpdate() && (
            <button onClick={activateUpdate}>Aplicar actualización</button>
          )}
        </Dialog>
      )}
      {info && (
        <Dialog name="Aviso" close={() => notify("")}>
          <p>{info}</p>
        </Dialog>
      )}
    </div>
  );
}
import { hasUpdate } from "../pwa";
import { type Dataset, validate } from "../domain/model";
function putRecordArchive(d: Dataset, row: Entity, restore: boolean) {
  const m = d.modules.find((m) => m.id === row.module)!;
  if (restore) validate(m, row.values, d.records, row.id);
  d.records[d.records.findIndex((r) => r.id === row.id)] = {
    ...row,
    archived: !restore,
    rev: row.rev + 1,
  };
}
