export type SessionAttendance =
  | "no-event"
  | "unknown"
  | "attended"
  | "late"
  | "absent-excused"
  | "absent-unexcused";

// Ids de AssistanceType (Back/.../Domain/Aggregates/Assistances/AssistanceType.cs).
const ATTENDANCE_BY_ASSISTANCE_TYPE: Record<number, SessionAttendance> = {
  1: "attended",
  2: "absent-excused",
  3: "absent-unexcused",
  4: "late",
};

export const ATTENDANCE_LABELS: Record<SessionAttendance, string> = {
  attended: "Asistió",
  late: "Llegó tarde",
  "absent-excused": "No asistió (con excusa)",
  "absent-unexcused": "No asistió (sin excusa)",
  unknown: "Sin registrar",
  "no-event": "Sin evento",
};

/** Asistencia del jugador a una sesión a partir del tipo de asistencia de su convocatoria. */
export function attendanceFromAssistanceType(hasEvent: boolean, assistanceTypeId: number | null | undefined): SessionAttendance {
  if (!hasEvent) return "no-event";
  return (assistanceTypeId != null && ATTENDANCE_BY_ASSISTANCE_TYPE[assistanceTypeId]) || "unknown";
}

export function isAbsent(attendance: SessionAttendance): boolean {
  return attendance === "absent-excused" || attendance === "absent-unexcused";
}
