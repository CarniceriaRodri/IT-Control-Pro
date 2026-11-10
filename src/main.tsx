import { createRoot } from "react-dom/client";
import { openRepository } from "./data/repository";
import { App } from "./ui/App";
import "./ui/style.css";
const root = createRoot(document.getElementById("root")!);
async function start() {
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem("it-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const repo = await openRepository();
    root.render(<App repo={repo} initial={await repo.read()} />);
  } catch (e) {
    root.render(
      <main>
        <h1>No se ha podido abrir el espacio local</h1>
        <p>{String(e)}</p>
        <p>
          Conserva los datos del navegador. Comprueba el almacenamiento
          disponible y los permisos del sitio.
        </p>
      </main>,
    );
  }
}
void start();
