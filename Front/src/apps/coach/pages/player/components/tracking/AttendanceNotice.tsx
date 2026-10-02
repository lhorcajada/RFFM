import { Alert } from "@mui/material";
import type { SessionAttendance } from "../../utils/sessionAttendance";

/** Aviso de la asistencia del jugador a la sesión que se valora. No muestra nada si asistió. */
export default function AttendanceNotice({ attendance }: { attendance: SessionAttendance }) {
  switch (attendance) {
    case "absent-excused":
    case "absent-unexcused":
      return (
        <Alert severity="warning">
          El jugador no asistió a este entrenamiento ({attendance === "absent-excused" ? "con excusa" : "sin excusa"}).
          Si valoras algún subprincipio, explica en el comentario por qué.
        </Alert>
      );
    case "late":
      return <Alert severity="info">El jugador llegó tarde a este entrenamiento.</Alert>;
    case "unknown":
      return <Alert severity="info">No hay asistencia registrada para este jugador en esta sesión.</Alert>;
    case "no-event":
      return (
        <Alert severity="info">
          La sesión no está vinculada a un evento del calendario; no se puede comprobar la asistencia.
        </Alert>
      );
    default:
      return null;
  }
}
