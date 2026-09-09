import styles from "./MetricLegend.module.css";

export type MetricLegendItem = { tone: "high" | "mid" | "low"; rangeLabel: string };

type Props = {
  /** Nombre de la métrica mostrado como encabezado de la leyenda (p.ej. "Rodaje", "Disponibilidad"). */
  label: string;
  /** Tramos de color a mostrar, en el orden deseado. */
  items: MetricLegendItem[];
  /** Incluye el ítem "Sin datos" (gris) al final. Por defecto `true`. */
  showNoData?: boolean;
};

const TONE_CLASS: Record<MetricLegendItem["tone"], string> = {
  high: "dotHigh",
  mid: "dotMid",
  low: "dotLow",
};

/**
 * Leyenda compacta y siempre visible de los colores usados por `MetricBadge`,
 * parametrizable por métrica (etiqueta + tramos de color).
 */
export default function MetricLegend({ label, items, showNoData = true }: Props) {
  return (
    <div className={styles.legend} aria-label={`Leyenda de ${label}`}>
      <span className={styles.label}>{label}</span>
      {items.map((item) => (
        <span className={styles.item} key={`${item.tone}-${item.rangeLabel}`}>
          <span className={`${styles.dot} ${styles[TONE_CLASS[item.tone]]}`} />
          {item.rangeLabel}
        </span>
      ))}
      {showNoData && (
        <span className={styles.item}>
          <span className={`${styles.dot} ${styles.dotNone}`} />
          Sin datos
        </span>
      )}
    </div>
  );
}
