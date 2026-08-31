import { Chip } from "@mui/material";
import { EventAttendanceSummaryDto } from "../../services/eventAttendanceSummaryService";
import styles from "./EventAttendanceBadges.module.css";

interface Props {
  summary: EventAttendanceSummaryDto | undefined;
  isPlayer: boolean;
}

// Real ConvocationStatus names (Convocation.ConvocationStatusId), matching
// the labels ConvocationCard.tsx already uses elsewhere in the app — this is
// the caller's own *decided* status, so past-participle wording ("Aceptado",
// "Rechazado") rather than ConvocationCard's action-button wording
// ("Aceptar", "Rechazar").
const statusLabels: Record<string, string> = {
  Pending: "Pendiente",
  Accepted: "Aceptado",
  Deconvoke: "Rechazado",
  Justified: "Justificado",
};

const statusColors: Record<string, { bg: string; fg: string }> = {
  Accepted: { bg: "rgba(46,125,50,0.35)", fg: "#a5d6a7" },
  Deconvoke: { bg: "rgba(230,100,100,0.35)", fg: "#ef9a9a" },
  Justified: { bg: "rgba(255,152,0,0.3)", fg: "#ffb74d" },
  Pending: { bg: "rgba(255,193,7,0.22)", fg: "#ffd54f" },
};

export function EventAttendanceBadges({ summary, isPlayer }: Props) {
  if (!summary) return null;

  if (isPlayer) {
    // `myStatus === null` means the caller isn't convoked to this event at
    // all (backend only fills myStatus for convoked players) — nothing to
    // show, as opposed to "Pending" which means convoked but not yet decided.
    if (summary.myStatus == null) return null;

    const myStatus = summary.myStatus;
    const labelText = `Tu estado: ${statusLabels[myStatus] ?? myStatus}`;
    const colors = statusColors[myStatus] ?? statusColors.Pending;
    return (
      <div className={styles.playerContainer}>
        <Chip
          label={labelText}
          size="small"
          sx={{
            backgroundColor: colors.bg,
            color: colors.fg,
            fontWeight: 700,
            fontSize: "0.7rem",
            height: 20,
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.coachContainer}>
      <Chip
        label={`Convocados: ${summary.convocados}`}
        size="small"
        sx={{
          backgroundColor: "rgba(120,130,150,0.3)",
          color: "#cfd8dc",
          fontWeight: 700,
          fontSize: "0.7rem",
          height: 20,
        }}
      />
      <Chip
        label={`Van: ${summary.going}`}
        size="small"
        sx={{
          backgroundColor: "rgba(46,125,50,0.35)",
          color: "#a5d6a7",
          fontWeight: 700,
          fontSize: "0.7rem",
          height: 20,
        }}
      />
      <Chip
        label={`Pendientes: ${summary.pending}`}
        size="small"
        sx={{
          backgroundColor: "rgba(255,193,7,0.22)",
          color: "#ffd54f",
          fontWeight: 700,
          fontSize: "0.7rem",
          height: 20,
        }}
      />
      <Chip
        label={`No van: ${summary.notGoing}`}
        size="small"
        sx={{
          backgroundColor: "rgba(230,100,100,0.35)",
          color: "#ef9a9a",
          fontWeight: 700,
          fontSize: "0.7rem",
          height: 20,
        }}
      />
      <Chip
        label={`${summary.attendancePercentage.toLocaleString("es-ES")}%`}
        size="small"
        sx={{
          backgroundColor: "rgba(66,165,245,0.25)",
          color: "#64b5f6",
          fontWeight: 700,
          fontSize: "0.7rem",
          height: 20,
        }}
      />
    </div>
  );
}
