import styles from "./PlayerFormLegend.module.css";

/**
 * Leyenda única y consolidada de los 3 indicadores de estado de forma mostrados por
 * `PlayerFormBars`: `Ef` (Estado de forma) y `Rodaje` comparten criterio (verde ≥80,
 * ámbar 50-79, rojo <50); `Cansancio` usa el criterio invertido (rojo ≥70, ámbar 40-69,
 * verde <40, ya que un cansancio alto es negativo).
 *
 * Sustituye a las leyendas independientes de Rodaje/Disponibilidad — una sola leyenda
 * por pantalla en vez de una por indicador.
 */
export default function PlayerFormLegend() {
  return (
    <div className={styles.legend} aria-label="Leyenda de Ef, Rodaje y Cansancio">
      <div className={styles.row}>
        <span className={styles.label}>Ef / Rodaje</span>
        <span className={styles.item}>
          <span className={`${styles.dot} ${styles.dotHigh}`} />
          ≥80
        </span>
        <span className={styles.item}>
          <span className={`${styles.dot} ${styles.dotMid}`} />
          50-79
        </span>
        <span className={styles.item}>
          <span className={`${styles.dot} ${styles.dotLow}`} />
          &lt;50
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Cansancio</span>
        <span className={styles.item}>
          <span className={`${styles.dot} ${styles.dotHigh}`} />
          &lt;40
        </span>
        <span className={styles.item}>
          <span className={`${styles.dot} ${styles.dotMid}`} />
          40-69
        </span>
        <span className={styles.item}>
          <span className={`${styles.dot} ${styles.dotLow}`} />
          ≥70
        </span>
      </div>
      <span className={styles.item}>
        <span className={`${styles.dot} ${styles.dotNone}`} />
        Sin datos
      </span>
    </div>
  );
}
