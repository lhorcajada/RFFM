const percentFormat = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

export function formatPercent(probability: number): string {
  return percentFormat.format(probability);
}

export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}
