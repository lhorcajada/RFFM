import { useEffect, useState } from "react";
import { getConvocations } from "../../../services/convocationService";
import { attendanceFromAssistanceType, isAbsent, type SessionAttendance } from "../utils/sessionAttendance";

export { isAbsent, type SessionAttendance };

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
        setAttendance(attendanceFromAssistanceType(true, typeId));
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
