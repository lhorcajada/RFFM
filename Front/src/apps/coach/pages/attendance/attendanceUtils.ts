export const eventTypeColorMap: Record<string, string> = {
  Partidos: "#1976d2",
  Entrenamiento: "#2e7d32",
  "Torneo/Competición": "#d32f2f",
  Otro: "#6a1b9a",
};

export function getEventTypeColor(name?: string | null): string {
  if (!name) return "#607d8b";
  return eventTypeColorMap[name] ?? "#607d8b";
}
