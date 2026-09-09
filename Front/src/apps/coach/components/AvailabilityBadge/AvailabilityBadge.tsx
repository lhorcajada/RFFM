import { Tooltip } from "@mui/material";
import MetricBadge, { type MetricTier } from "../MetricBadge/MetricBadge";

type Props = {
  /** Disponibilidad = max(0, Forma física - Cansancio), 0-100. `null`/`undefined` → no se renderiza nada. */
  availability: number | null | undefined;
  /** Mostrados en el tooltip, no en el indicador compacto (decisión de diseño: solo Disponibilidad ocupa espacio en banquillo/campo). */
  physicalFitness?: number | null;
  fatigue?: number | null;
  dense?: boolean;
  variant?: "chip" | "dot";
  className?: string;
};

// Igual criterio que Rodaje/Forma física: valores altos son buenos.
const AVAILABILITY_TIERS: MetricTier[] = [
  { min: 80, tone: "high" },
  { min: 50, tone: "mid" },
  { min: -Infinity, tone: "low" },
];

function formatComponent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

/**
 * Indicador compacto de "Disponibilidad" para tarjetas de jugador en pestañas de convocatoria.
 * Muestra solo Disponibilidad (Forma física y Cansancio van en el tooltip) para no saturar
 * el espacio limitado de banquillo/campo con 3 indicadores nuevos por jugador.
 */
export default function AvailabilityBadge({
  availability,
  physicalFitness,
  fatigue,
  dense,
  variant = "chip",
  className,
}: Props) {
  if (availability == null) return null;

  const badge = (
    <MetricBadge
      value={availability}
      tiers={AVAILABILITY_TIERS}
      label="Disponibilidad"
      dense={dense}
      variant={variant}
      className={className}
    />
  );

  if (physicalFitness == null && fatigue == null) return badge;

  return (
    <Tooltip
      title={`Forma física: ${formatComponent(physicalFitness)} · Cansancio: ${formatComponent(fatigue)}`}
    >
      {badge}
    </Tooltip>
  );
}
