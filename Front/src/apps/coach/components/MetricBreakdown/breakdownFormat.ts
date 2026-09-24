const TRAINING_TYPE_LABELS: Record<string, string> = {
  Fisico: "Físico",
  Tecnico: "Técnico",
  Tactico: "Táctico",
};

const MATCH_TYPE_LABELS: Record<number, string> = {
  1: "Liga",
  4: "Amistoso",
  6: "Torneo",
};

export function formatNumber(value: number, maxDecimals = 2): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: maxDecimals });
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** dd/mm a partir del prefijo yyyy-mm-dd del ISO (sin conversión de zona horaria). */
export function formatShortDate(iso: string | null): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${match[3]}/${match[2]}` : "—";
}

export function formatTrainingTypes(types: string[]): string {
  if (types.length === 0) return "Entreno";
  return types.map((t) => TRAINING_TYPE_LABELS[t] ?? t).join(", ");
}

export function matchTypeLabel(eventTypeId: number): string {
  return MATCH_TYPE_LABELS[eventTypeId] ?? "Partido";
}

const TRAINING_EVENT_TYPE_ID = 2;

export function eventLabel(eventTypeId: number, trainingTypes: string[]): string {
  return eventTypeId === TRAINING_EVENT_TYPE_ID ? formatTrainingTypes(trainingTypes) : matchTypeLabel(eventTypeId);
}
