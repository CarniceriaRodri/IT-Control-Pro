interface Prompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<unknown>;
}
let prompt: Prompt | null = null,
  registration: ServiceWorkerRegistration | undefined,
  problem = "";
const changed = () => window.dispatchEvent(new Event("pwa-status"));
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  prompt = e as Prompt;
  changed();
});
window.addEventListener("appinstalled", () => {
  prompt = null;
  changed();
});
// El servidor local Python/Node ya ofrece la aplicación. Una PWA cache-first
// puede dejar el portátil mostrando un JS antiguo tras actualizar el ZIP.
const localServer = ["127.0.0.1", "localhost"].includes(location.hostname)
  && ["8787", "8788"].includes(location.port);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  if (localServer) {
    // Desactivar el service worker antiguo sin tocar IndexedDB ni localStorage.
    void navigator.serviceWorker.getRegistrations()
      .then((items) => Promise.all(items
        .filter((item) => item.scope.startsWith(location.origin + "/"))
        .map((item) => item.unregister())))
      .catch(() => {});
    if ("caches" in window) {
      void caches.keys()
        .then((keys) => Promise.all(keys
          .filter((key) => key.startsWith("it-control-pro:"))
          .map((key) => caches.delete(key))))
        .catch(() => {});
    }
  } else {
    navigator.serviceWorker.register("./sw.js")
      .then((r) => {
        registration = r;
        r.addEventListener("updatefound", () =>
          r.installing?.addEventListener("statechange", changed),
        );
        changed();
      })
      .catch((e) => {
        problem = String(e);
        changed();
      });
  }
}
export async function install() {
  if (prompt) {
    const p = prompt;
    prompt = null;
    await p.prompt();
    await p.userChoice;
  }
}
export const hasUpdate = () => Boolean(registration?.waiting);
export function activateUpdate() {
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => location.reload(),
    { once: true },
  );
  registration?.waiting?.postMessage("activate");
}
export function statusPwa() {
  return matchMedia("(display-mode: standalone)").matches
    ? "La aplicación se ejecuta en modo instalado."
    : problem
      ? "Error al preparar el uso sin conexión: " + problem
      : !isSecureContext
        ? "Se necesita HTTPS o localhost."
        : hasUpdate()
          ? "Hay una actualización disponible."
          : prompt
            ? "El navegador ofrece instalación."
            : "La instalación depende del navegador y del dispositivo.";
}
