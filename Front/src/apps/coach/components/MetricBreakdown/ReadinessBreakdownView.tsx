import type { ReadinessBreakdown } from "../../services/teamPlayerStatisticsService";
import {
  formatNumber,
  formatPercent,
  formatShortDate,
  formatTrainingTypes,
  matchTypeLabel,
} from "./breakdownFormat";
import styles from "./MetricBreakdown.module.css";

type Props = {
  breakdown: ReadinessBreakdown;
  /** Rodaje final (0-100) que muestra la barra. */
  value: number;
};

export default function ReadinessBreakdownView({ breakdown: b, value }: Props) {
  return (
    <div className={styles.root} data-testid="readiness-breakdown">
      <p className={styles.summary}>
        El rodaje mide cuánto has entrenado y jugado en las últimas semanas.
      </p>
      {b.consideredTrainings.length > 0 && (
        <section className={styles.step}>
          <h4 className={styles.stepTitle}>Entrenos ({formatPercent(b.trainingComponent)})</h4>
          <ul className={styles.list} data-testid="readiness-training-list">
            {b.consideredTrainings.map((t) => (
              <li key={t.eventId} className={styles.item}>
                <span className={styles.itemDate}>{formatShortDate(t.eventDate)}</span>
                <span>{formatTrainingTypes(t.trainingTypes)}</span>
                <span className={styles.itemMuted}>peso {formatNumber(t.typeWeight)}</span>
                {!t.countsTowardScore && <span className={styles.itemMuted}>no cuenta</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {b.consideredMatches.length > 0 && (
        <section className={styles.step}>
          <h4 className={styles.stepTitle}>Partidos ({formatPercent(b.matchComponent)})</h4>
          <ul className={styles.list}>
            {b.consideredMatches.map((m) => (
              <li key={m.eventId} className={styles.item}>
                <span className={styles.itemDate}>{formatShortDate(m.eventDate)}</span>
                <span>{matchTypeLabel(m.eventTypeId)}</span>
                <span>{m.minutesPlayed}'</span>
                <span className={styles.itemMuted}>peso {formatNumber(m.typeWeight)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {b.recentAbsences.length > 0 && (
        <section className={styles.step}>
          <h4 className={styles.stepTitle}>Ausencias recientes</h4>
          <ul className={styles.list}>
            {b.recentAbsences.map((a) => (
              <li key={a.eventId} className={styles.item} data-testid="readiness-absence-item">
                <span className={styles.itemDate}>{formatShortDate(a.date)}</span>
                <span className={styles.itemBad}>{a.reason}</span>
                <span className={styles.itemMuted}>{a.pointsImpact} puntos</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className={styles.formula}>
        {`${formatNumber(b.trainingWeight)} × ${formatPercent(b.trainingComponent)} + ${formatNumber(b.matchWeight)} × ${formatPercent(b.matchComponent)} = ${formatPercent(value)}`}
      </p>
    </div>
  );
}
