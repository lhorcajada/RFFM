import MetricLegend from "../MetricLegend/MetricLegend";

/**
 * Leyenda compacta y siempre visible de los colores usados por `AvailabilityBadge`
 * para el indicador de "Disponibilidad": verde ≥80, ámbar 50-79, rojo <50, gris sin datos.
 * Mismo criterio de color que Rodaje/Forma física (valores altos son buenos).
 */
export default function AvailabilityLegend() {
  return (
    <MetricLegend
      label="Disponibilidad"
      items={[
        { tone: "high", rangeLabel: "≥80" },
        { tone: "mid", rangeLabel: "50-79" },
        { tone: "low", rangeLabel: "<50" },
      ]}
    />
  );
}
