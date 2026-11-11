import { useEffect, useState } from "react";
import { UserRound, Palette, UserPlus, Trash2, ShieldAlert } from "lucide-react";
import {
  addProfile, currentProfile, removeProfile,
  type ProfilesState, type ProfileSettings, type OperatorProfile
} from "../data/profiles";

export function ProfileSettingsPanel({
  profiles, onChange, modules,
}: {
  profiles: ProfilesState;
  onChange: (next: ProfilesState) => void;
  modules: { id: string; name: string; active: boolean }[];
}) {
  const [newName, setNewName] = useState("");
  const [draftName, setDraftName] = useState(() => currentProfile(profiles).name);
  const [error, setError] = useState("");
  const current = currentProfile(profiles);
  useEffect(() => { setDraftName(current.name); }, [current.id]);
  const update = (patch: Partial<OperatorProfile>) => {
    onChange({...profiles,profiles:profiles.profiles.map(p=>
      p.id===current.id ? {...p,...patch} : p)});
  };
  const settings = (patch: Partial<ProfileSettings>) =>
    update({settings:{...current.settings,...patch}});
  const act = (fn:()=>void) => {
    try {setError("");fn();} catch(e) {setError(String(e));}
  };
  const homeOptions=[{id:"Panel",name:"Panel principal"},
    ...modules.filter(m=>m.active).map(m=>({id:m.id,name:m.name}))];
  return <section className="profileSettingsPanel">
    <h2><UserRound size={19}/> Perfiles de trabajo</h2>
    <p>Personaliza la aplicación para cada persona que utilice este dispositivo.
      Estos perfiles no solicitan contraseña ni limitan los permisos de edición o acceso.</p>
    <div className="profileSettingsGrid">
      <label>Perfil activo
        <select aria-label="Perfil activo" value={profiles.activeId}
          onChange={e=>act(()=>onChange({...profiles,activeId:e.target.value}))}>
          {profiles.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Nombre visible
        <input aria-label="Nombre del perfil" maxLength={48} value={draftName}
          onChange={e=>setDraftName(e.target.value)}
          onBlur={()=>act(()=>{
            if(!draftName.trim()) {setDraftName(current.name);return;}
            update({name:draftName.trim()});
          })}/>
      </label>
      <label>Área o función (opcional)
        <input aria-label="Función del perfil" maxLength={60}
          placeholder="Ej. Soporte técnico" value={current.position}
          onChange={e=>update({position:e.target.value})}/>
      </label>
      <label>Pantalla principal al abrir
        <select aria-label="Pantalla de inicio" value={current.settings.home}
          onChange={e=>settings({home:e.target.value})}>
          {homeOptions.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
    </div>
    <form className="inline" onSubmit={e=>{e.preventDefault();act(()=>{
      onChange(addProfile(profiles,newName));setNewName("");
    });}}>
      <label>Crear otro perfil
        <input aria-label="Nuevo perfil" maxLength={48} value={newName}
          onChange={e=>setNewName(e.target.value)} placeholder="Nombre del operador" required/>
      </label>
      <button type="submit"><UserPlus size={16}/> Crear perfil</button>
      <button type="button" disabled={profiles.profiles.length<2} onClick={()=>
        act(()=>{if(confirm("¿Eliminar este perfil local? No se borrarán registros.")) onChange(removeProfile(profiles,current.id));})
      }><Trash2 size={16}/> Eliminar perfil</button>
    </form>
    <h3>Módulos favoritos</h3>
    <p>Los favoritos aparecerán primero en el menú y en las tarjetas del Panel principal.</p>
    <div className="profileFavoriteGrid">
      {modules.filter(m=>m.active).map(m=>(
        <label key={m.id} className="profileFavorite">
          <input type="checkbox" aria-label={"Favorito "+m.name}
            checked={current.settings.favorites.includes(m.id)}
            onChange={e=>settings({favorites:e.target.checked
              ? [...current.settings.favorites.filter(x=>x!==m.id),m.id].slice(0,12)
              : current.settings.favorites.filter(x=>x!==m.id)})}/>
          {m.name}
        </label>
      ))}
    </div>
    <h3><Palette size={18}/> Apariencia de este perfil</h3>
    <div className="profileSettingsGrid">
      <label>Tema
        <select aria-label="Tema visual" value={current.settings.theme}
          onChange={e=>settings({theme:e.target.value as ProfileSettings["theme"]})}>
          <option value="system">Automático (sistema)</option>
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </select>
      </label>
      <label>Color principal
        <select aria-label="Color de acento" value={current.settings.accent}
          onChange={e=>settings({accent:e.target.value as ProfileSettings["accent"]})}>
          <option value="green">Verde</option>
          <option value="blue">Azul</option>
          <option value="purple">Violeta</option>
          <option value="amber">Ámbar</option>
        </select>
      </label>
      <label>Densidad de formularios y tablas
        <select aria-label="Densidad de interfaz" value={current.settings.density}
          onChange={e=>settings({density:e.target.value as ProfileSettings["density"]})}>
          <option value="comfortable">Cómoda</option>
          <option value="compact">Compacta</option>
        </select>
      </label>
      <label>Tamaño de texto
        <select aria-label="Tamaño de interfaz" value={current.settings.scale}
          onChange={e=>settings({scale:e.target.value as ProfileSettings["scale"]})}>
          <option value="normal">Normal</option>
          <option value="large">Grande</option>
        </select>
      </label>
    </div>
    <p className="profileSafety"><ShieldAlert size={19}/>
      <span>Estos son perfiles de uso local, no cuentas seguras. Cualquiera con acceso al
        navegador o al servidor experimental puede cambiar de perfil y consultar
        los datos. El uso corporativo compartido requiere autenticación y permisos
        comprobados en un servidor autorizado.</span></p>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
