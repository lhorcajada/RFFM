import { useEffect, useState } from "react";
import { getConvocations } from "../../../services/convocationService";

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

export function isAbsent(attendance: SessionAttendance): boolean {
  return attendance === "absent-excused" || attendance === "absent-unexcused";
}

/** Asistencia del jugador al evento del calendario vinculado a una sesión de entrenamiento. */
export function usePlayerSessionAttendance(sportEventId: string | null | undefined, teamPlayerId: string) {
  const [attendance, setAttendance] = useState<SessionAttendance>(sportEventId ? "unknown" : "no-event");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sportEventId) {
      setAttendance("no-event");
      return;
    }
    let cancelled = false;
    setAttendance("unknown");
    setLoading(true);
    getConvocations(sportEventId)
      .then((convocations) => {
        if (cancelled) return;
        const typeId = convocations.find((c) => c.player.id === teamPlayerId)?.assistanceTypeId;
        setAttendance((typeId != null && ATTENDANCE_BY_ASSISTANCE_TYPE[typeId]) || "unknown");
      })
      .catch(() => {
        if (!cancelled) setAttendance("unknown");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sportEventId, teamPlayerId]);

  return { attendance, loading };
}
