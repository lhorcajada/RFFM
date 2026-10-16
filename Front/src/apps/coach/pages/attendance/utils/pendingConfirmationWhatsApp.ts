export type PendingConfirmationEventSummary = {
  eventTypeLabel: string;
  rivalName: string | null;
  dateES: string;
  time: string | null;
  location: string | null;
};

function buildEventReminderMessage(
  summary: PendingConfirmationEventSummary,
  greeting: string,
  callToAction: string
): string {
  const lines = [
    greeting,
    `${summary.eventTypeLabel}${summary.rivalName ? ` vs ${summary.rivalName}` : ""}`,
    `${summary.dateES}${summary.time ? ` · ${summary.time}` : ""}`,
  ];
  if (summary.location) lines.push(summary.location);
  lines.push("", callToAction);
  return lines.join("\n");
}

export function buildPendingConfirmationMessage(
  summary: PendingConfirmationEventSummary,
  playerAlias: string,
  deepLinkUrl: string
): string {
  return buildEventReminderMessage(
    summary,
    `Hola! Recordatorio de convocatoria para ${playerAlias}.`,
    `Confirma tu asistencia aquí: ${deepLinkUrl}`
  );
}

export function buildPendingAvailabilityMessage(
  summary: PendingConfirmationEventSummary,
  playerAlias: string,
  deepLinkUrl: string
): string {
  return buildEventReminderMessage(
    summary,
    `Hola! Necesitamos saber la disponibilidad de ${playerAlias} para el partido.`,
    `Indica si está disponible aquí: ${deepLinkUrl}`
  );
}

export function buildWaMeLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
