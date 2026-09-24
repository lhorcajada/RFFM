import type { DailyLoadBreakdown, DailyLoadStep } from "../../services/teamPlayerStatisticsService";
import { eventLabel, formatNumber, formatShortDate } from "./breakdownFormat";
import styles from "./MetricBreakdown.module.css";

type Props = {
  breakdown: DailyLoadBreakdown;
};

function restStatus(b: DailyLoadBreakdown): string {
  const days = b.currentRestStreakDays;
  if (days === 0) return "No lleva ningún día sin actividad.";
  const plural = (n: number) => (n === 1 ? "día" : "días");
  if (days <= b.graceRestDays) {
    const left = b.graceRestDays - days + 1;
    return `Lleva ${days} ${plural(days)} sin actividad: empieza a bajar en ${left} ${plural(left)}.`;
  }
  const decaying = days - b.graceRestDays;
  return `Lleva ${days} ${plural(days)} sin actividad: bajando desde hace ${decaying} ${plural(decaying)}.`;
}

function stepTitle(step: DailyLoadStep): string {
  if (step.kind === "Decay") {
    return `${formatShortDate(step.date)} – ${formatShortDate(step.endDate)}`;
  }
  return formatShortDate(step.date);
}

function stepDescription(step: DailyLoadStep): string {
  if (step.kind === "Decay") return "Sin actividad";
  return step.events
    .map((e) => (e.minutesPlayed > 0 ? `${eventLabel(e.eventTypeId, e.trainingTypes)} ${e.minutesPlayed}'` : eventLabel(e.eventTypeId, e.trainingTypes)))
    .join(" + ");
}

function stepChange(step: DailyLoadStep): string {
  const delta = step.valueAfter - step.valueBefore;
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(delta), 1)} (${formatNumber(step.valueBefore, 1)} → ${formatNumber(step.valueAfter, 1)})`;
}

export default function DailyLoadBreakdownView({ breakdown: b }: Props) {
  return (
    <div className={styles.root} data-testid="daily-load-breakdown">
      <p className={styles.summary}>
        {`Cada entreno o partido suma. Tras ${b.graceRestDays} días seguidos sin actividad empieza a bajar, cada día un poco más (hasta ${formatNumber(b.decayMaxPerDay)} puntos al día).`}
      </p>
      <p className={styles.notice}>{restStatus(b)}</p>
      <p className={styles.itemMuted}>
        {`${b.trainingsAttended} entrenos y ${b.matchesPlayed} partidos (${b.matchMinutesPlayed}') en los últimos ${b.replayDays} días.`}
      </p>

      {b.steps.length > 0 && (
        <section className={styles.step} aria-label="Evolución">
          <h4 className={styles.stepTitle}>Evolución</h4>
          <ul className={styles.list}>
            {b.steps.map((s) => (
              <li key={`${s.kind}-${s.date}`} className={styles.item} data-testid="daily-load-step">
                <span className={styles.itemDate}>{stepTitle(s)}</span>
                <span className={s.kind === "Decay" ? styles.itemBad : undefined}>{stepDescription(s)}</span>
                <span className={styles.itemMuted}>{stepChange(s)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {b.missedEvents.length > 0 && (
        <section className={styles.step} aria-label="Días sin actividad">
          <h4 className={styles.stepTitle}>Días sin actividad</h4>
          <ul className={styles.list}>
            {b.missedEvents.map((m) => (
              <li key={m.eventId} className={styles.item}>
                <span className={styles.itemDate}>{formatShortDate(m.date)}</span>
                <span>{eventLabel(m.eventTypeId, [])}</span>
                <span className={styles.itemBad}>{m.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
