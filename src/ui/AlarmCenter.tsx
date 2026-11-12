import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset, Entity } from "../domain/model";

type Delay = 0 | 5 | 10 | 15 | 30 | 60;
type Setting = { enabled: boolean; minutes: Delay; sound: boolean };
type Override = { enabled: boolean; minutes: Delay; snoozedUntil?: number; dismissedEvent?: string };
type AlarmItem = { row: Entity; when: number; due: number; label: string; key: string; minutes: Delay };
const KEY = "it-control-pro-alarms-v1";
const SETTINGS = "it-control-pro-alarm-settings-v1";
const options: Delay[] = [0, 5, 10, 15, 30, 60];
const defaultSetting: Setting = { enabled: true, minutes: 0, sound: false };
type WindowsSound = "aviso" | "alarma" | "campana" | "silencio";
const sounds: WindowsSound[] = ["alarma","aviso","campana","silencio"];
const WINDOWS_SETTING = "it-control-pro-windows-alarm-v1";
const isLocalPython = location.port === "8788" && ["127.0.0.1","localhost"].includes(location.hostname);
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
  // Acepta el formato ISO del calendario y fechas españolas de registros anteriores.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  const spanish = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(date.trim());
  const hour = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if ((!iso && !spanish) || !hour) return null;
  const year = Number(iso?.[1] ?? spanish?.[3]);
  const month = Number(iso?.[2] ?? spanish?.[2]);
  const day = Number(iso?.[3] ?? spanish?.[1]);
  const hours = Number(hour[1]), minutes = Number(hour[2]);
  const value = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return value.getFullYear() === year && value.getMonth() === month - 1 &&
    value.getDate() === day && value.getHours() === hours && value.getMinutes() === minutes
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
  const now = Date.now();
  return data.records.flatMap(row => {
    const p = planned(row);
    if (!p) return [];
    const due = localDate(p.date, p.time);
    if (due === null) return [];
    const override = overrides[row.id];
    if (override?.enabled === false) return [];
    const minutes = validDelay(override?.minutes) ? override.minutes : setting.minutes;
    // Una cita creada dentro del margen debe avisar inmediatamente.
    const when = due >= now ? Math.max(due - minutes * 60000, now) : due - minutes * 60000;
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
  const [desktop, setDesktop] = useState(() => safeJson<{enabled:boolean;sound:WindowsSound}>(WINDOWS_SETTING,{enabled:false,sound:"alarma"}));
  const [desktopMessage, setDesktopMessage] = useState("");
  const lastSeen = useRef(new Set<string>());
  const initialized = useRef(false);
  const updateSetting = (next: Setting) => {setSetting(next); save(SETTINGS,next);};
  const updateOverrides = (next: Record<string,Override>) => {setOverrides(next); save(KEY,next);};
  const items = useMemo(()=>compute(data,overrides,setting),[data,overrides,setting]);
  const invalid = useMemo(()=>data.records.filter(row=>{const p=planned(row);return p!==null && localDate(p.date,p.time)===null;}),[data]);
  const due = items.filter(item=>item.when<=clock && clock-item.due<24*60*60*1000);
  const next = items.filter(item=>item.when>clock).slice(0,12);
  const activeItem = active ? items.find(item=>item.key===active) : undefined;
  // Las alarmas quedan en Python: puede cerrarse Chrome, no el servidor.
  useEffect(()=>{
    if(!isLocalPython) return;
    const sync = async ()=>{
      try {
        const now=Date.now();
        const selected=items.filter(item=>item.when>=now-24*60*60*1000 && item.when<=now+180*24*60*60*1000)
          .slice(0,250).map(item=>({key:item.key,label:item.label.slice(0,200),module:item.row.module,at:item.when}));
        const response=await fetch("/api/alarms/configure",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({enabled:desktop.enabled && setting.enabled,sound:desktop.sound,items:selected}),
        });
        if(!response.ok) throw Error("Respuesta del servidor: "+response.status);
        const status = await response.json() as {scheduled?:number;next?:number|null};
        if (!desktop.enabled) setDesktopMessage("Avisos programados de Windows desactivados. Activa la casilla para recibirlos.");
        else if (!setting.enabled) setDesktopMessage("Las alarmas generales están desactivadas.");
        else {
          const count = status.scheduled ?? 0;
          const nextDate = typeof status.next === "number"
            ? " Próximo aviso: " + new Date(status.next).toLocaleString("es-ES") + "."
            : "";
          setDesktopMessage(count + " alarma(s) programada(s) en Windows." + nextDate +
            (count === 0 ? " Comprueba que existe una cita futura con fecha y hora válidas." : ""));
        }
      }catch(e){setDesktopMessage("No se pudieron sincronizar las alarmas: "+String(e));}
    };
    void sync();
  },[items,desktop.enabled,desktop.sound,setting.enabled]);
  const changeDesktop=(next:{enabled:boolean;sound:WindowsSound})=>{
    setDesktop(next);
    save(WINDOWS_SETTING,next);
  };
  const testDesktop=async()=>{
    try{
      const response=await fetch("/api/alarms/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sound:desktop.sound})});
      if(!response.ok) throw Error("Respuesta "+response.status);
      setDesktopMessage("Prueba enviada: comprueba la ventana de Windows. Activa los avisos de Windows para las citas programadas.");
    }catch(e){setDesktopMessage("No se pudo ejecutar la prueba: "+String(e));}
  };
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
    <p>Los avisos de la página funcionan mientras esté abierta. En Windows, con el servidor Python activo, la ventana de recordatorio permanecerá pendiente hasta confirmarla o posponerla.</p>
    {invalid.length > 0 && <p role="status">Hay {invalid.length} registro(s) sin alarma por fecha u hora no válida. Edita la cita y selecciona una fecha en el calendario y una hora (por ejemplo, 09:30).</p>}
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
      <button type="button" onClick={testAlarm}>Probar aviso dentro de la aplicación</button>
    </div>
    {isLocalPython && <div className="alarmWindowsControls">
      <strong>Alarmas de escritorio de Windows (sin Chrome)</strong>
      <p>Una ventana grande en primer plano, con sonido configurable y opciones para confirmar o posponer, puede avisarte aunque Chrome esté cerrado; el servidor Python debe seguir ejecutándose.</p>
      <div className="inline">
        <label><input type="checkbox" checked={desktop.enabled} onChange={e=>changeDesktop({...desktop,enabled:e.target.checked})}/> Activar avisos de Windows</label>
        <label>Sonido
          <select value={desktop.sound} onChange={e=>changeDesktop({...desktop,sound:e.target.value as WindowsSound})}>
            {sounds.map(v=><option key={v} value={v}>{({alarma:"Alarma",aviso:"Aviso",campana:"Campana",silencio:"Sin sonido"} as Record<WindowsSound,string>)[v]}</option>)}
          </select>
        </label>
        <button type="button" onClick={()=>void testDesktop()}>Probar ventana de Windows</button>
      </div>
      {desktopMessage && <p role="status">{desktopMessage}</p>}
    </div>}
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
