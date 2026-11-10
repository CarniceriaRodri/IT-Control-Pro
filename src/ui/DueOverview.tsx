import { useMemo } from "react";
import type { Dataset, Entity } from "../domain/model";

/**
 * Panel informativo, sin servicio de notificaciones ni sondeos en segundo plano.
 * Los vencimientos se calculan con la fecha civil local al abrir la aplicación.
 */
export function DueOverview({data, open}:{data:Dataset;open:(r:Entity)=>void}) {
  const today=useMemo(()=>{
    const d=new Date();
    const pad=(v:number)=>String(v).padStart(2,"0");
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  },[]);
  const items=data.records.filter(r => !r.archived && (
    (r.module==="Movimientos" &&
      String(r.values.tipo||"")==="Préstamo" &&
      !["Devuelto","Finalizado","Cancelado"].includes(String(r.values.estado||"")) &&
      typeof r.values.devolucionPrevista==="string" &&
      r.values.devolucionPrevista!=="") ||
    (r.module==="Tareas" &&
      !["Completada","Cancelada"].includes(String(r.values.estado||"")) &&
      typeof r.values.fechaPrevista==="string" && r.values.fechaPrevista!=="")
  )).map(r=>({
    row:r,
    date:String(r.module==="Movimientos"?r.values.devolucionPrevista:r.values.fechaPrevista),
    label:String(r.module==="Movimientos" ? r.values.referencia||"Préstamo" : r.values.asunto||"Tarea")
  })).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,30);
  if(!items.length)return null;
  const overdue=items.filter(x=>x.date<today).length;
  return <section className="dueOverview" aria-label="Seguimiento de plazos">
    <div className="sectionTitle"><h2>Seguimiento de tareas y devoluciones</h2></div>
    <p>Vencimientos visibles al abrir la aplicación. No son avisos automáticos del sistema.</p>
    {overdue>0 && <p role="status"><strong>{overdue} vencimientos anteriores a hoy.</strong></p>}
    <div className="tableScroll">
      <table><thead><tr><th>Fecha</th><th>Módulo</th><th>Registro</th><th>Situación</th><th>Acción</th></tr></thead>
      <tbody>{items.map(({row,date,label})=><tr key={row.id}>
        <td>{date}</td><td>{row.module}</td><td>{label}</td>
        <td>{date<today?"Vencido":date===today?"Hoy":"Próximo"}</td>
        <td><button type="button" onClick={()=>open(row)}>Abrir</button></td>
      </tr>)}</tbody></table>
    </div>
  </section>;
}
