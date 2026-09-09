import MetricLegend from "../MetricLegend/MetricLegend";

/**
 * Leyenda compacta y siempre visible de los colores usados por `ReadinessBadge`
 * para el indicador de "Rodaje": verde ≥80, ámbar 50-79, rojo <50, gris sin datos.
 */
export default function ReadinessLegend() {
  return (
    <MetricLegend
      label="Rodaje"
      items={[
        { tone: "high", rangeLabel: "≥80" },
        { tone: "mid", rangeLabel: "50-79" },
        { tone: "low", rangeLabel: "<50" },
      ]}
    />
  );
}
