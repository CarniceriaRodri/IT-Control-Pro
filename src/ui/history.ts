/**
 * Navegación de la SPA: las páginas y formularios se integran en el historial
 * real del navegador. Un punto de retorno inicial lleva al Panel, para que
 * «Atrás» desde la primera pantalla no abandone IT Control Pro por accidente.
 */
export type AppRoute = { app: "IT-Control-Pro"; version: 1; page: string; editor?: string };
type Guard = { app: "IT-Control-Pro"; version: 1; guard: true };
const marker = "IT-Control-Pro";
export function isRoute(value: unknown): value is AppRoute {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AppRoute>;
  return v.app === marker && v.version === 1 && typeof v.page === "string" && v.page.length > 0;
}
export function isGuard(value: unknown): value is Guard {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Guard>;
  return v.app === marker && v.version === 1 && v.guard === true;
}
export function urlFor(route: Pick<AppRoute, "page" | "editor">) {
  const url = new URL(location.href);
  const query = new URLSearchParams();
  query.set("modulo", route.page);
  if (route.editor) query.set("registro", route.editor);
  url.hash = query.toString();
  return url.pathname + url.search + url.hash;
}
export function routeFromUrl(): AppRoute {
  const query = new URLSearchParams(location.hash.replace(/^#/, ""));
  return {
    app: marker,
    version: 1,
    page: query.get("modulo") || "Panel",
    ...(query.get("registro") ? { editor: query.get("registro")! } : {}),
  };
}
export function makeRoute(page: string, editor?: string): AppRoute {
  return { app: marker, version: 1, page, ...(editor ? { editor } : {}) };
}
export function initializeHistory(route: AppRoute) {
  if (isRoute(history.state)) return;
  // Se reemplaza únicamente la entrada actual: no se alteran páginas ajenas.
  history.replaceState({ app: marker, version: 1, guard: true } satisfies Guard, "", urlFor(makeRoute("Panel")));
  history.pushState(route, "", urlFor(route));
}
export function pushAppRoute(route: AppRoute) {
  const current = history.state;
  if (isRoute(current) && current.page === route.page && current.editor === route.editor) return;
  history.pushState(route, "", urlFor(route));
}
export function replaceAppRoute(route: AppRoute) {
  history.replaceState(route, "", urlFor(route));
}
