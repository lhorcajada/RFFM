import styles from "./MetricBadge.module.css";

/** A color tier: `value >= min` (evaluated in order) maps to `tone`. */
export type MetricTier = { min: number; tone: "high" | "mid" | "low" };

type Props = {
  /** Valor de la métrica (0-100 típicamente). `null`/`undefined` → no se renderiza nada. */
  value: number | null | undefined;
  /** Tramos de color, ordenados de mayor a menor `min`. El último debe cubrir el resto de valores (p.ej. `min: -Infinity`). */
  tiers: MetricTier[];
  /** Nombre de la métrica, usado como `title` (chip) o prefijo del tooltip (dot). */
  label: string;
  /** Cuando está embebido en una fila flex que ya aporta separación (gap), evita el margen propio. */
  dense?: boolean;
  /**
   * `chip` (por defecto): pastilla con el número, para listas/tarjetas con espacio.
   * `dot`: punto de color mínimo, para slots pequeños (campo de juego). El valor
   * exacto se muestra en el `title` (tooltip nativo) al pasar el ratón.
   */
  variant?: "chip" | "dot";
  /** Clase extra para posicionar el indicador (p.ej. absoluto sobre un slot). */
  className?: string;
  /** Formateo del valor mostrado. Por defecto: entero + "%". */
  formatValue?: (value: number) => string;
};

function resolveTone(value: number, tiers: MetricTier[]): "high" | "mid" | "low" {
  for (const tier of tiers) {
    if (value >= tier.min) return tier.tone;
  }
  return "low";
}

function defaultFormat(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Indicador compacto y genérico de una métrica 0-100 (Rodaje, Disponibilidad, ...),
 * parametrizable por etiqueta y tramos de color.
 */
export default function MetricBadge({ value, tiers, label, dense, variant = "chip", className, formatValue }: Props) {
  if (value == null) return null;

  const tone = resolveTone(value, tiers);
  const text = (formatValue ?? defaultFormat)(value);

  if (variant === "dot") {
    return (
      <span
        className={`${styles.dot} ${styles[tone]} ${className ?? ""}`}
        title={`${label}: ${text}`}
      />
    );
  }

  return (
    <span
      className={`${styles.badge} ${styles[tone]} ${dense ? styles.dense : ""} ${className ?? ""}`}
      title={label}
    >
      {text}
    </span>
  );
}
