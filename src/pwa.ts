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
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register("./sw.js")
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
