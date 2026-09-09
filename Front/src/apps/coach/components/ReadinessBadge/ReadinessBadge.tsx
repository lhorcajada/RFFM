import styles from "./ReadinessBadge.module.css";

type Props = {
  /** Rodaje (0-100). `null`/`undefined` → no se renderiza nada. */
  value: number | null | undefined;
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
};

function tierClass(value: number): string {
  if (value >= 80) return styles.high;
  if (value >= 50) return styles.mid;
  return styles.low;
}

/**
 * Indicador compacto de "Rodaje" para tarjetas de jugador.
 * Mismo criterio de color que `SquadStatistics`: verde ≥80, ámbar 50-79, rojo <50.
 */
export default function ReadinessBadge({ value, dense, variant = "chip", className }: Props) {
  if (value == null) return null;

  if (variant === "dot") {
    return (
      <span
        className={`${styles.dot} ${tierClass(value)} ${className ?? ""}`}
        title={`Rodaje: ${Math.round(value)}%`}
      />
    );
  }

  return (
    <span
      className={`${styles.badge} ${tierClass(value)} ${dense ? styles.dense : ""} ${className ?? ""}`}
      title="Rodaje"
    >
      {Math.round(value)}%
    </span>
  );
}
