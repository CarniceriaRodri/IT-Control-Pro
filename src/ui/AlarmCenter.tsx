import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset, Entity } from "../domain/model";

type Delay = 0 | 5 | 10 | 15 | 30 | 60;
type Setting = { enabled: boolean; minutes: Delay; sound: boolean };
type Override = { enabled: boolean; minutes: Delay; snoozedUntil?: number; dismissedEvent?: string };
type AlarmItem = { row: Entity; when: number; due: number; label: string; key: string; minutes: Delay };
const KEY = "it-control-pro-alarms-v1";
const SETTINGS = "it-control-pro-alarm-settings-v1";
const options: Delay[] = [0, 5, 10, 15, 30, 60];
const defaultSetting: Setting = { enabled: true, minutes: 15, sound: false };
const validDelay = (v: unknown): v is Delay => options.includes(v as Delay);
function safeJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
function readOverrides(): Record<string, Override> {
  const raw = safeJson<Record<string, Override>>(KEY, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function readSettings(): Setting {
  const raw = safeJson<Partial<Setting>>(SETTINGS, {});
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : defaultSetting.enabled,
    minutes: validDelay(raw.minutes) ? raw.minutes : defaultSetting.minutes,
    sound: raw.sound === true,
  };
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* Avisos visibles siguen funcionando mientras la pestaña esté abierta. */ }
}
function localDate(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y,m,d] = date.split("-").map(Number);
  const [h,min] = time.split(":").map(Number);
  const value = new Date(y,m-1,d,h,min,0,0);
  return value.getFullYear()===y && value.getMonth()===m-1 &&
    value.getDate()===d && value.getHours()===h && value.getMinutes()===min
    ? value.getTime() : null;
}
function planned(row: Entity): {date: string; time: string; label: string} | null {
  if (row.archived) return null;
  const v = row.values;
  const state = String(v.estado || "").trim().toLocaleLowerCase("es");
  if (["finalizado","finalizada","completada","completado","cancelado","cancelada","devuelto"].includes(state)) return null;
  if (row.module === "Agenda") return { date: String(v.fecha || ""), time: String(v.hora || ""), label: String(v.asunto || "Cita de agenda") };
  if (row.module === "Tareas") return { date: String(v.fechaPrevista || ""), time: String(v.hora || "09:00"), label: String(v.asunto || "Tarea pendiente") };
  if (row.module === "Movimientos" && String(v.tipo || "") === "Préstamo")
    return { date: String(v.devolucionPrevista || ""), time: String(v.horaDevolucion || "09:00"), label: String(v.referencia || "Devolución de equipo") };
  return null;
}
function compute(data: Dataset, overrides: Record<string, Override>, setting: Setting): AlarmItem[] {
  if (!setting.enabled) return [];
  return data.records.flatMap(row => {
    const p = planned(row);
    if (!p) return [];
    const due = localDate(p.date, p.time);
    if (due === null) return [];
    const override = overrides[row.id];
    if (override?.enabled === false) return [];
    const minutes = validDelay(override?.minutes) ? override.minutes : setting.minutes;
    const when = due - minutes * 60000;
    const key = row.id + ":" + due + ":" + minutes;
    if (override?.dismissedEvent === key) return [];
    return [{row, due, when: Math.max(when, override?.snoozedUntil || 0),label:p.label,key,minutes}];
  }).sort((a,b) => a.when-b.when);
}
function sound() {
  try {
    const Audio = window.AudioContext;
    if (!Audio) return;
    const audio = new Audio();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08,audio.currentTime+0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001,audio.currentTime+0.25);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime+0.27);
    oscillator.onended = () => { void audio.close(); };
  } catch { /* El navegador puede bloquear sonido sin una interacción previa. */ }
}
export function AlarmCenter({ data, open, showControls = true }: { data: Dataset; open: (row: Entity) => void; showControls?: boolean }) {
  const [setting, setSetting] = useState(readSettings);
  const [overrides, setOverrides] = useState(readOverrides);
  const [clock, setClock] = useState(Date.now);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [testVisible, setTestVisible] = useState(false);
  const lastSeen = useRef(new Set<string>());
  const initialized = useRef(false);
  const updateSetting = (next: Setting) => {setSetting(next); save(SETTINGS,next);};
  const updateOverrides = (next: Record<string,Override>) => {setOverrides(next); save(KEY,next);};
  const items = useMemo(()=>compute(data,overrides,setting),[data,overrides,setting]);
  const due = items.filter(item=>item.when<=clock && clock-item.due<24*60*60*1000);
  const next = items.filter(item=>item.when>clock).slice(0,12);
  const activeItem = active ? items.find(item=>item.key===active) : undefined;
  useEffect(()=>{
    const tick = () => setClock(Date.now());
    const sync = () => {setSettingsFromStorage();tick();};
    const setSettingsFromStorage = () => {setSetting(readSettings());setOverrides(readOverrides());};
    const id = window.setInterval(tick,15000);
    window.addEventListener("focus",sync);
    window.addEventListener("storage",sync);
    document.addEventListener("visibilitychange",tick);
    return ()=>{clearInterval(id);window.removeEventListener("focus",sync);window.removeEventListener("storage",sync);document.removeEventListener("visibilitychange",tick);};
  },[]);
  useEffect(()=>{
    if (!initialized.current) {
      // No inundar con notificaciones antiguas al cargar la aplicación.
      due.filter(i=>clock-i.due>5*60*1000).forEach(i=>lastSeen.current.add(i.key));
      initialized.current=true;
    }
    for (const item of due) {
      if(lastSeen.current.has(item.key)) continue;
      lastSeen.current.add(item.key);
      // Aviso visible dentro de la aplicación, incluso sin permiso de Windows.
      setActive(item.key);
      if(setting.sound) sound();
      if("Notification" in window && Notification.permission==="granted" && window.isSecureContext) {
        try {
          const notice = new Notification("IT Control Pro · Recordatorio",{
            body: item.label + " · " + item.row.module,
            tag: "it-control-" + item.key,
            icon: "./icon-192.png",
          });
          notice.onclick=()=>{window.focus();open(item.row);notice.close();};
        } catch { /* Mostrar siempre el aviso en la aplicación. */ }
      }
    }
  },[due,clock,setting.sound,open]);
  const amend = (item:AlarmItem, patch: Partial<Override>)=>{
    updateOverrides({...overrides,[item.row.id]:{...{enabled:true,minutes:item.minutes},...overrides[item.row.id],...patch}});
  };
  const dismiss=(item:AlarmItem)=>{amend(item,{dismissedEvent:item.key,snoozedUntil:undefined});setActive(null);};
  const snooze=(item:AlarmItem,minutes:number)=>{amend(item,{snoozedUntil:Date.now()+minutes*60000});setActive(null);};
  const canNotify = "Notification" in window && window.isSecureContext;
  const askPermission = async ()=>{
    if(canNotify) {
      try { await Notification.requestPermission(); setClock(Date.now()); }
      catch { /* Denegación o política del navegador. */ }
    }
  };
  const testAlarm=()=>{
    setTestVisible(true);
    if(setting.sound) sound();
    if("Notification" in window && Notification.permission==="granted" && window.isSecureContext) {
      try { new Notification("IT Control Pro · Prueba de alarma",{body:"El aviso de prueba funciona correctamente.",icon:"./icon-192.png"}); }
      catch { /* El aviso visual permanece disponible. */ }
    }
  };
  return <>
  {showControls && <section className="alarmCenter" aria-label="Alarmas y recordatorios">
    <div className="sectionTitle"><h2>Alarmas y recordatorios</h2></div>
    <p>Los avisos se comprueban mientras IT Control Pro esté abierto. Con la aplicación cerrada no hay alarmas garantizadas. La configuración es local de este navegador.</p>
    <div className="alarmControls">
      <label><input type="checkbox" checked={setting.enabled} onChange={e=>updateSetting({...setting,enabled:e.target.checked})}/> Activar alarmas</label>
      <label>Antelación predeterminada
        <select aria-label="Antelación de alarmas" value={setting.minutes} onChange={e=>updateSetting({...setting,minutes:Number(e.target.value) as Delay})}>
          {options.map(v=><option key={v} value={v}>{v===0?"A la hora":v+" minutos antes"}</option>)}
        </select>
      </label>
      <label><input type="checkbox" checked={setting.sound} onChange={e=>{updateSetting({...setting,sound:e.target.checked});if(e.target.checked)sound();}}/> Sonido al avisar</label>
      <button type="button" disabled={!canNotify || Notification.permission!=="default"} onClick={()=>void askPermission()}>
        {canNotify ? Notification.permission==="granted"?"Notificaciones permitidas":Notification.permission==="denied"?"Notificaciones bloqueadas":"Permitir notificaciones Windows":"Notificaciones no disponibles"}
      </button>
      <button type="button" onClick={()=>setVisible(v=>!v)} aria-expanded={visible}>{visible?"Ocultar próximos avisos":"Configurar próximos avisos"}</button>
      <button type="button" onClick={testAlarm}>Probar aviso ahora</button>
    </div>
    {!!due.length && <div className="alarmDue" role="status" aria-live="polite">
      <strong>{due.length} recordatorio(s) pendiente(s)</strong>
      {due.slice(0,10).map(item=><div className="alarmEntry" key={item.key}>
        <div><strong>{item.label}</strong><small>{item.row.module} · {new Date(item.due).toLocaleString("es-ES")}</small></div>
        <div className="alarmButtons">
          <button type="button" onClick={()=>open(item.row)}>Abrir</button>
          <button type="button" onClick={()=>snooze(item,5)}>Posponer 5 min</button>
          <button type="button" onClick={()=>snooze(item,15)}>15 min</button>
          <button type="button" onClick={()=>dismiss(item)}>Descartar</button>
        </div>
      </div>)}
    </div>}
    {visible && <div className="alarmUpcoming">
      <p>Para cada registro puedes elegir una antelación distinta. Las tareas y devoluciones sin hora usan las 09:00.</p>
      {next.length===0 && <p>No hay avisos próximos con fecha válida.</p>}
      {next.map(item=><div className="alarmEntry" key={item.key}>
        <div><strong>{item.label}</strong><small>{item.row.module} · {new Date(item.due).toLocaleString("es-ES")}</small></div>
        <label>Recordar
          <select aria-label={"Antelación para "+item.label} value={item.minutes} onChange={e=>amend(item,{minutes:Number(e.target.value) as Delay,snoozedUntil:undefined,dismissedEvent:undefined})}>
            {options.map(v=><option key={v} value={v}>{v===0?"A la hora":v+" minutos antes"}</option>)}
          </select>
        </label>
        <button type="button" onClick={()=>open(item.row)}>Abrir</button>
        <button type="button" onClick={()=>amend(item,{enabled:false})}>Desactivar</button>
      </div>)}
    </div>}
  </section>}
  {(testVisible || activeItem) && <aside className="alarmToast" role="alert" aria-live="assertive">
    {testVisible ? <>
      <strong>Prueba de alarma correcta</strong>
      <p>IT Control Pro puede mostrar avisos mientras esta pestaña esté abierta. Las notificaciones de Windows requieren permiso del navegador.</p>
      <button type="button" onClick={()=>setTestVisible(false)}>Cerrar prueba</button>
    </> : activeItem ? <>
      <strong>Recordatorio · {activeItem.row.module}</strong>
      <p>{activeItem.label} · {new Date(activeItem.due).toLocaleString("es-ES")}</p>
      <div className="alarmButtons">
        <button type="button" onClick={()=>{open(activeItem.row);setActive(null);}}>Abrir</button>
        <button type="button" onClick={()=>snooze(activeItem,5)}>Posponer 5 min</button>
        <button type="button" onClick={()=>dismiss(activeItem)}>Descartar</button>
      </div>
    </> : null}
  </aside>}
  </>;
}
