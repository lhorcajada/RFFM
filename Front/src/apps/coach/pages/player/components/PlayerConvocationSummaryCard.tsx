import type { PlayerAbsenceMatch, PlayerConvocationSummary } from "../../../services/convocationService";
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
        <span className={styles.absenceValue}>
          {match.rivalName ?? "—"} · {match.eventTypeName ?? "—"} · {formatAbsenceDate(match.matchDate)}
        </span>
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
      <div className={styles.tile}>
        <span className={styles.tileValue}>{summary.totalConvocations}</span>
        <span className={styles.tileLabel}>Convocatorias</span>
      </div>
      <AbsenceTile
        label="Última desconvocación"
        match={summary.lastDeconvokedMatch}
        emptyLabel="Sin desconvocaciones registradas"
      />
      <AbsenceTile
        label="Última ausencia"
        match={summary.lastJustifiedAbsenceMatch}
        emptyLabel="Sin ausencias registradas"
      />
    </div>
  );
}
