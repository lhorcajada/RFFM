import MetricBadge, { type MetricTier } from "../MetricBadge/MetricBadge";

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

// Verde ≥80, ámbar 50-79, rojo <50 — mismo criterio que `SquadStatistics`.
const READINESS_TIERS: MetricTier[] = [
  { min: 80, tone: "high" },
  { min: 50, tone: "mid" },
  { min: -Infinity, tone: "low" },
];

/**
 * Indicador compacto de "Rodaje" para tarjetas de jugador.
 * Envuelve `MetricBadge` con los tramos de color y la etiqueta propios de Rodaje.
 */
export default function ReadinessBadge({ value, dense, variant = "chip", className }: Props) {
  return (
    <MetricBadge
      value={value}
      tiers={READINESS_TIERS}
      label="Rodaje"
      dense={dense}
      variant={variant}
      className={className}
    />
  );
}
