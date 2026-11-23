import type { ReportSubstitutionWindow } from "../../../services/matchReportService";
import styles from "./LiveMatchSubstitutions.module.css";

type Props = {
  windows: ReportSubstitutionWindow[];
};

/** Cambios del partido de solo lectura, en tarjetas por ventana de cambios. */
export default function LiveMatchSubstitutions({ windows }: Props) {
  if (windows.length === 0) return null;

  return (
    <section className={styles.root} aria-label="Cambios">
      <h3 className={styles.title}>Cambios</h3>
      <div className={styles.windows}>
        {windows.map((w, i) => (
          <article key={`${w.windowIndex}-${i}`} className={styles.window}>
            <div className={styles.windowHeader}>
              <span className={styles.windowTitle}>{w.isHalftime ? "Descanso" : `Ventana ${w.windowIndex}`}</span>
              <span className={styles.minute}>{w.minute}'</span>
            </div>
            <ul className={styles.list}>
              {w.swaps.map((s, j) => (
                <li key={j} className={styles.swap}>
                  <span className={styles.swapIn}>Entra {s.inPlayerName}</span>
                  {s.outPlayerName && <span className={styles.swapOut}>Sale {s.outPlayerName}</span>}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
