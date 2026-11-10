import { useEffect, useState } from "react";
import type { Repository } from "../data/repository";
import type { Dataset } from "../domain/model";
import { defaults, periods, labels, type RestorePoint } from "../data/periods";
import { exportFull } from "../data/portable";
export function BackupSchedule({
  repo,
  stage,
  data,
}: {
  repo: Repository;
  stage: (d: Dataset) => void;
  data: Dataset;
}) {
  const [policy, set] = useState(defaults),
    [points, list] = useState<RestorePoint[]>([]),
    [error, msg] = useState("");
  async function refresh() {
    list((await repo.points()).sort((a, b) => b.stamp.localeCompare(a.stamp)));
  }
  useEffect(() => {
    repo
      .retention()
      .then(set)
      .catch((e) => msg(String(e)));
  }, [repo]);
  useEffect(() => {
    refresh().catch((e) => msg(String(e)));
  }, [data, repo]);
  return (
    <section>
      <h2>Copias automáticas</h2>
      <p>
        Se conserva el último estado guardado de cada periodo en este navegador.
        Con la aplicación cerrada no se ejecutan tareas. Descarga una copia para
        conservarla fuera del dispositivo.
      </p>
      <form
        className="inline"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await repo.setRetention(policy);
            await refresh();
            msg("Conservación actualizada.");
          } catch (e) {
            msg(String(e));
          }
        }}
      >
        {periods.map((k) => (
          <label key={k}>
            {labels[k]}
            <input
              type="number"
              min="0"
              max="90"
              required
              value={policy[k]}
              onChange={(e) => set({ ...policy, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
        <button>Aplicar conservación</button>
      </form>
      <small>
        0 desactiva el periodo y elimina sus puntos de recuperación.
      </small>
      {periods.map((k) => (
        <details key={k}>
          <summary>
            {labels[k]} ({points.filter((p) => p.period === k).length})
          </summary>
          {points
            .filter((p) => p.period === k)
            .map((p) => (
              <div className="fieldRow" key={p.key}>
                <span>{new Date(p.stamp).toLocaleString("es-ES")}</span>
                {["Revisar", "Descargar"].map((action) => (
                  <button
                    key={action}
                    onClick={async () => {
                      try {
                        const d = await repo.point(p.key);
                        if (!d) throw Error("Este punto ha caducado.");
                        if (action === "Revisar") stage(d);
                        else await exportFull(d, repo.file);
                      } catch (e) {
                        msg(String(e));
                      }
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            ))}
        </details>
      ))}
      {error && <p role="status">{error}</p>}
    </section>
  );
}
