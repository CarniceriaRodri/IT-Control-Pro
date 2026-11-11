/**
 * Perfiles de trabajo DEL DISPOSITIVO. Son preferencias y etiquetas de autoría,
 * NO cuentas autenticadas: no conceden ni revocan permisos de acceso.
 * Nunca guardamos contraseñas, PIN ni secretos en el navegador.
 */
export type Theme = "light" | "dark" | "system";
export type Accent = "green" | "blue" | "purple" | "amber";
export type Density = "comfortable" | "compact";
export type Scale = "normal" | "large";
export interface ProfileSettings {
  theme: Theme;
  accent: Accent;
  density: Density;
  scale: Scale;
  home: string;
}
export interface OperatorProfile {
  id: string;
  name: string;
  position: string;
  settings: ProfileSettings;
}
export interface ProfilesState {
  version: 1;
  activeId: string;
  profiles: OperatorProfile[];
}
const KEY = "it-control-pro-local-profiles-v1";
export const defaultSettings: ProfileSettings = {
  theme: "system", accent: "green", density: "comfortable",
  scale: "normal", home: "Panel",
};
export function initialProfiles(): ProfilesState {
  let theme: Theme = "system";
  try {
    const legacy = localStorage.getItem("it-theme");
    if (legacy === "light" || legacy === "dark") theme = legacy;
  } catch { /* Algunos navegadores bloquean almacenamiento. */ }
  return {
    version: 1, activeId: "local-default",
    profiles: [{
      id: "local-default", name: "Usuario local", position: "",
      settings: { ...defaultSettings, theme },
    }],
  };
}
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
function normalizeSettings(s: unknown): ProfileSettings {
  const p = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
  return {
    theme: oneOf(p.theme, ["light","dark","system"] as const, "system"),
    accent: oneOf(p.accent, ["green","blue","purple","amber"] as const, "green"),
    density: oneOf(p.density, ["comfortable","compact"] as const, "comfortable"),
    scale: oneOf(p.scale, ["normal","large"] as const, "normal"),
    home: typeof p.home === "string" && p.home.length <= 90 ? p.home : "Panel",
  };
}
export function readProfiles(): ProfilesState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialProfiles();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return initialProfiles();
    const s = parsed as Partial<ProfilesState>;
    if (s.version !== 1 || !Array.isArray(s.profiles)) return initialProfiles();
    const seen = new Set<string>();
    const profiles = s.profiles
      .filter((p): p is OperatorProfile => !!p && typeof p === "object")
      .filter(p => typeof p.id === "string" && p.id.length <= 80 &&
        !!p.id && !seen.has(p.id) && seen.add(p.id) &&
        typeof p.name === "string" && !!p.name.trim())
      .slice(0, 20).map(p => ({
        id: p.id, name: p.name.trim().slice(0, 48),
        position: typeof p.position === "string" ? p.position.slice(0, 60) : "",
        settings: normalizeSettings(p.settings),
      }));
    if (!profiles.length) return initialProfiles();
    return { version: 1,
      activeId: profiles.some(p=>p.id===s.activeId) ? String(s.activeId) : profiles[0].id,
      profiles };
  } catch { return initialProfiles(); }
}
export function currentProfile(state: ProfilesState): OperatorProfile {
  return state.profiles.find(p=>p.id===state.activeId) || state.profiles[0];
}
export function persistProfiles(state: ProfilesState): ProfilesState {
  if (!state.profiles.length || state.profiles.length>20) throw Error("Se admiten entre 1 y 20 perfiles.");
  if (new Set(state.profiles.map(p=>p.id)).size !== state.profiles.length ||
      !state.profiles.some(p=>p.id===state.activeId))
    throw Error("La lista de perfiles es inválida.");
  for (const profile of state.profiles) {
    if (!profile.name.trim() || profile.name.length > 48) throw Error("El nombre debe tener entre 1 y 48 caracteres.");
  }
  localStorage.setItem(KEY,JSON.stringify(state));
  return state;
}
export function applyProfile(profile: OperatorProfile) {
  const root = document.documentElement;
  const {theme,accent,density,scale} = profile.settings;
  root.dataset.theme = theme==="system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light") : theme;
  root.dataset.accent = accent;
  root.dataset.density = density;
  root.dataset.scale = scale;
}
export function addProfile(state: ProfilesState,name:string): ProfilesState {
  const clean=name.trim().replace(/\s+/g," ");
  if (!clean || clean.length>48) throw Error("Escribe un nombre de 1 a 48 caracteres.");
  if (state.profiles.length>=20) throw Error("Máximo 20 perfiles en este dispositivo.");
  if (state.profiles.some(p=>p.name.toLocaleLowerCase("es")===clean.toLocaleLowerCase("es")))
    throw Error("Ya existe un perfil con ese nombre.");
  const id=crypto.randomUUID();
  return {...state,activeId:id,profiles:[...state.profiles,{
    id,name:clean,position:"",settings:{...defaultSettings},
  }]};
}
export function removeProfile(state: ProfilesState,id:string): ProfilesState {
  if(state.profiles.length<=1)throw Error("Debe quedar al menos un perfil.");
  const profiles=state.profiles.filter(p=>p.id!==id);
  if(profiles.length===state.profiles.length)throw Error("Perfil no encontrado.");
  return {...state,profiles,
    activeId:state.activeId===id?profiles[0].id:state.activeId};
}
