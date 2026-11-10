import { writeCsv } from "../data/calc";
import { downloadBlob } from "../data/media";
import { useState } from "react";
import type { Dataset, Module } from "../domain/model";
import type { Repository } from "../data/repository";
import { Attachments, emptyFiles, type FileDraft } from "./Attachments";
import { ImportTable } from "./ImportTable";
import { Dialog } from "./Fields";
import { NetworkDiagnostics } from "./NetworkDiagnostics";
import type { Write } from "./Admin";
export function ModuleTools({
  mod,
  data,
  write,
  repo,
}: {
  mod: Module;
  data: Dataset;
  write: Write;
  repo: Repository;
}) {
  const [mode, set] = useState(""),
    [files, edit] = useState<FileDraft>(emptyFiles),
    [error, msg] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      {mod.id === "Redes" && <NetworkDiagnostics saved={data.records.filter(r=>r.module===mod.id && !r.archived).map(r=>({ip:String(r.values.ip||""),device:String(r.values.dispositivo||"Equipo")}))}/>}
      <div className="inline moduleTools">
        <button onClick={() => set("table")}>Importar tabla</button>
        <button
          onClick={() => {
            const fields = mod.fields.filter((f) => f.visible);
            const rows = data.records
              .filter((r) => r.module === mod.id && !r.archived)
              .map((r) =>
                fields.map((f) => {
                  const v = r.values[f.id];
                  return Array.isArray(v) ? v.join("|") : String(v ?? "");
                }),
              );
            downloadBlob(
              writeCsv(
                fields.map((f) => f.label),
                rows,
              ),
              mod.name + ".csv",
            );
          }}
        >
          Exportar CSV
        </button>
        <button
          onClick={() => {
            edit({ refs: mod.files || [], blobs: new Map() });
            msg("");
            set("files");
          }}
        >
          Archivos y fotos ({mod.files?.length || 0})
        </button>
      </div>
      {mode === "table" && (
        <ImportTable
          mod={mod}
          data={data}
          write={write}
          close={() => set("")}
          load={repo.file}
        />
      )}
      {mode === "files" && (
        <Dialog name={"Archivos · " + mod.name} close={() => set("")}>
          <Attachments
            value={files}
            change={edit}
            load={repo.file}
            pending={setBusy}
            library={[...data.modules, ...data.records].flatMap((item) => item.files || [])}
          />
          {error && <p role="alert">{error}</p>}
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await write(
                  "Archivos de módulo",
                  mod.id,
                  (d) => {
                    d.modules.find((m) => m.id === mod.id)!.files = files.refs;
                  },
                  false,
                  files.blobs,
                );
                set("");
              } catch (e) {
                msg(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar archivos
          </button>
        </Dialog>
      )}
    </>
  );
}
