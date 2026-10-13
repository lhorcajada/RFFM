import type {
  PlayerAbsenceMatch,
  PlayerAttendanceRatio,
  PlayerConvocationSummary,
} from "../../../services/convocationService";
import { formatShortDate } from "../../../components/MetricBreakdown/breakdownFormat";
import { calledButAbsentLabel, leagueAbsenceReason } from "../../squad/playerStatsText";
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
  notes = [],
}: {
  label: string;
  ratio: PlayerAttendanceRatio;
  notes?: string[];
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileValue}>
        {ratio.attended} de {ratio.possible}
      </span>
      <span className={styles.tileLabel}>{label}</span>
      {notes.map((note) => (
        <span key={note} className={styles.tileNote}>
          {note}
        </span>
      ))}
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

  const friendliesNote = calledButAbsentLabel(summary.friendlies.calledButAbsent);
  const leagueNotes = summary.leagueAbsences.map(
    (a) => `${formatShortDate(a.date)} vs ${a.opponent} · ${leagueAbsenceReason(a)}`,
  );

  return (
    <div className={styles.grid}>
      <div className={styles.tile}>
        <span className={styles.tileValue}>{summary.totalStarts}</span>
        <span className={styles.tileLabel}>Titularidades</span>
      </div>
      <RatioTile label="Entrenamientos" ratio={summary.trainings} />
      <RatioTile label="Amistosos" ratio={summary.friendlies} notes={friendliesNote ? [friendliesNote] : []} />
      <RatioTile label="Liga" ratio={summary.league} notes={leagueNotes} />
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
