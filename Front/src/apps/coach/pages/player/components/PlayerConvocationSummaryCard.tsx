import type {
  PlayerAbsenceMatch,
  PlayerAttendanceRatio,
  PlayerConvocationSummary,
} from "../../../services/convocationService";
import { calledButAbsentLabel } from "../../squad/playerStatsText";
import styles from "./PlayerConvocationSummaryCard.module.css";

type Props = {
  summary: PlayerConvocationSummary | null;
  loading: boolean;
};

function formatAbsenceDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function RatioTile({
  label,
  ratio,
  showCalledButAbsent,
}: {
  label: string;
  ratio: PlayerAttendanceRatio;
  showCalledButAbsent: boolean;
}) {
  const note = showCalledButAbsent ? calledButAbsentLabel(ratio.calledButAbsent) : null;
  return (
    <div className={styles.tile}>
      <span className={styles.tileValue}>
        {ratio.attended} de {ratio.possible}
      </span>
      <span className={styles.tileLabel}>{label}</span>
      {note && <span className={styles.tileNote}>{note}</span>}
    </div>
  );
}

function AbsenceTile({
  label,
  match,
  emptyLabel,
}: {
  label: string;
  match: PlayerAbsenceMatch | null;
  emptyLabel: string;
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      {match ? (
        <>
          <span className={styles.absenceValue}>
            {match.rivalName ?? "—"} · {match.eventTypeName ?? "—"} · {formatAbsenceDate(match.matchDate)}
          </span>
          {match.reason && <span className={styles.absenceReason}>Motivo: {match.reason}</span>}
        </>
      ) : (
        <span className={styles.emptyValue}>{emptyLabel}</span>
      )}
    </div>
  );
}

export default function PlayerConvocationSummaryCard({ summary, loading }: Props) {
  if (!summary) {
    return loading ? null : (
      <div className={styles.emptyCard}>No hay convocatorias registradas.</div>
    );
  }

  return (
    <div className={styles.grid}>
      <div className={styles.tile}>
        <span className={styles.tileValue}>{summary.totalStarts}</span>
        <span className={styles.tileLabel}>Titularidades</span>
      </div>
      <RatioTile label="Entrenamientos" ratio={summary.trainings} showCalledButAbsent={false} />
      <RatioTile label="Amistosos" ratio={summary.friendlies} showCalledButAbsent />
      <RatioTile label="Liga" ratio={summary.league} showCalledButAbsent />
      <AbsenceTile
        label="Última desconvocatoria"
        match={summary.lastDeconvokedMatch}
        emptyLabel="Sin desconvocatorias registradas"
      />
      <AbsenceTile
        label="Última ausencia"
        match={summary.lastAbsenceMatch}
        emptyLabel="Sin ausencias registradas"
      />
    </div>
  );
}
