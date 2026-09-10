export type PendingConfirmationEventSummary = {
  eventTypeLabel: string;
  rivalName: string | null;
  dateES: string;
  time: string | null;
  location: string | null;
};

export function buildPendingConfirmationMessage(
  summary: PendingConfirmationEventSummary,
  playerAlias: string,
  deepLinkUrl: string
): string {
  const lines = [
    `Hola! Recordatorio de convocatoria para ${playerAlias}.`,
    `${summary.eventTypeLabel}${summary.rivalName ? ` vs ${summary.rivalName}` : ""}`,
    `${summary.dateES}${summary.time ? ` · ${summary.time}` : ""}`,
  ];
  if (summary.location) lines.push(summary.location);
  lines.push("", `Confirma tu asistencia aquí: ${deepLinkUrl}`);
  return lines.join("\n");
}

export function buildWaMeLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
