import { ImportHistory } from "./ImportHistory";
import { writeCsv } from "../data/calc";
import { CENTROS_DOCUMENTO } from "../data/centrosCatalog";
import { field, uid } from "../domain/model";
import { downloadBlob } from "../data/media";
import { useState } from "react";
import type { Dataset, Module } from "../domain/model";
import type { Repository } from "../data/repository";
import { Attachments, emptyFiles, type FileDraft } from "./Attachments";
import { ImportTable } from "./ImportTable";
import { Dialog } from "./Fields";
import { NetworkDiagnostics } from "./NetworkDiagnostics";
import { NetworkMonitor } from "./NetworkMonitor";
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
    [busy, setBusy] = useState(false),
    [centersPreview, setCentersPreview] = useState(false);
  return (
    <>
      <ImportHistory data={data} module={mod.id} write={write}/>
      {mod.id === "Redes" && <NetworkMonitor data={data} write={write} />}
      {mod.id === "Redes" && <NetworkDiagnostics saved={data.records.filter(r=>r.module===mod.id && !r.archived).map(r=>({ip:String(r.values.ip||""),device:String(r.values.dispositivo||"Equipo")}))}/>}
      <div className="inline moduleTools">
        <button onClick={() => set("table")}>Importar tabla</button>
        {mod.id === "Centros" && <button type="button" onClick={()=>{msg("");setCentersPreview(true);}}>Añadir centros del documento</button>}
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
      {mod.id === "Centros" && centersPreview && (
        <Dialog name="Añadir centros del documento" close={()=>setCentersPreview(false)}>
          <p>Se añadirán los centros, servicios y unidades del listado proporcionado, sin los códigos numéricos. Los registros existentes se conservan y las coincidencias se omiten.</p>
          <p><strong>{CENTROS_DOCUMENTO.length} entradas</strong> en Hospitales y unidades, Jerez-Costa Noroeste y Sierra de Cádiz.</p>
          <p>Se guardarán los nombres y su agrupación (zona, grupo y ámbito). No se modificarán los centros que ya tengas.</p>
          {error && <p role="alert">{error}</p>}
          <div className="inline">
            <button type="button" onClick={()=>setCentersPreview(false)}>Cancelar</button>
            <button type="button" className="primary" disabled={busy} onClick={async()=>{
              setBusy(true);msg("");
              try {
                let added=0;
                await write("Incorporación de centros sin códigos",mod.id,(d)=>{
                  const target=d.modules.find(m=>m.id===mod.id);
                  if(!target)throw Error("No existe el módulo Centros.");
                  for(const [id,label] of [["nombre","Nombre"],["zona","Zona"],["grupo","Grupo / dependencia"],["ambito","Ámbito"]]){
                    if(!target.fields.some(f=>f.id===id))target.fields.push(field(id,label));
                  }
                  const clean=(v:unknown)=>String(v??"").normalize("NFKC").trim().toLocaleLowerCase("es").replace(/\s+/g," ");
                  const known=new Set(d.records.filter(r=>r.module===mod.id && !r.archived).map(r=>
                    [clean(r.values.nombre),clean(r.values.zona),clean(r.values.grupo)].join("|")));
                  // Para registros antiguos sin zona/grupo, respetamos sus nombres sin duplicarlos.
                  const legacy=new Set(d.records.filter(r=>r.module===mod.id && !r.archived &&
                    !String(r.values.zona??"").trim() && !String(r.values.grupo??"").trim()).map(r=>clean(r.values.nombre)));
                  for(const item of CENTROS_DOCUMENTO){
                    const key=[clean(item.nombre),clean(item.zona),clean(item.grupo)].join("|");
                    if(known.has(key) || legacy.has(clean(item.nombre)))continue;
                    d.records.push({id:uid(),module:mod.id,values:{nombre:item.nombre,zona:item.zona,grupo:item.grupo,ambito:item.ambito},rev:1,archived:false});
                    known.add(key);added++;
                  }
                },true);
                setCentersPreview(false);
                msg("Se añadieron "+added+" centros o unidades. Ya existían "+(CENTROS_DOCUMENTO.length-added)+".");
              }catch(e){msg(String(e));}
              finally{setBusy(false);}
            }}>Incorporar centros</button>
          </div>
        </Dialog>
      )}
      {mod.id === "Centros" && error && !centersPreview && mode !== "files" && <p role="status">{error}</p>}
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

