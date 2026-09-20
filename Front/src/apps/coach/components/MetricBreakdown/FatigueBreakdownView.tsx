import type { FatigueBreakdown } from "../../services/teamPlayerStatisticsService";
import {
  formatNumber,
  formatPercent,
  formatShortDate,
  formatTrainingTypes,
  matchTypeLabel,
} from "./breakdownFormat";
import styles from "./MetricBreakdown.module.css";

type Props = {
  breakdown: FatigueBreakdown;
  /** Cansancio final (0-100) que muestra la barra. */
  value: number;
};

export default function FatigueBreakdownView({ breakdown: b, value }: Props) {
  const isEmpty = b.consideredTrainings.length === 0 && b.consideredMatches.length === 0;

  return (
    <div className={styles.root} data-testid="fatigue-breakdown">
      <p className={styles.summary}>
        Cuanto más reciente y exigente es un entreno o partido, más cansancio aporta.
      </p>
      {isEmpty && <p className={styles.notice}>No hay entrenos ni partidos recientes.</p>}
      {b.consideredTrainings.length > 0 && (
        <section className={styles.step}>
          <h4 className={styles.stepTitle}>Entrenos ({formatPercent(b.trainingComponent)})</h4>
          <ul className={styles.list}>
            {b.consideredTrainings.map((t) => (
              <li key={t.eventId} className={styles.item} data-testid="fatigue-training-item">
                <span className={styles.itemDate}>{formatShortDate(t.eventDate)}</span>
                <span>{formatTrainingTypes(t.trainingTypes)}</span>
                <span className={styles.itemMuted}>peso {formatNumber(t.typeWeight)}</span>
                <span className={styles.itemMuted}>hace {t.daysAgo} d</span>
                <span>aporta {formatNumber(t.contribution)}</span>
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
              <li key={m.eventId} className={styles.item} data-testid="fatigue-match-item">
                <span className={styles.itemDate}>{formatShortDate(m.eventDate)}</span>
                <span>{matchTypeLabel(m.eventTypeId)}</span>
                <span>{m.minutesPlayed}'</span>
                <span className={styles.itemMuted}>peso {formatNumber(m.typeWeight)}</span>
                <span className={styles.itemMuted}>hace {m.daysAgo} d</span>
                <span>aporta {formatNumber(m.effectiveMinutes, 1)}'</span>
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
