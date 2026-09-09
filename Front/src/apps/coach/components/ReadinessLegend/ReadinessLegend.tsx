import styles from "./ReadinessLegend.module.css";

/**
 * Leyenda compacta y siempre visible de los colores usados por `ReadinessBadge`
 * para el indicador de "Rodaje": verde ≥80, ámbar 50-79, rojo <50, gris sin datos.
 */
export default function ReadinessLegend() {
  return (
    <div className={styles.legend} aria-label="Leyenda de Rodaje">
      <span className={styles.label}>Rodaje</span>
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
      <span className={styles.item}>
        <span className={`${styles.dot} ${styles.dotNone}`} />
        Sin datos
      </span>
    </div>
  );
}
