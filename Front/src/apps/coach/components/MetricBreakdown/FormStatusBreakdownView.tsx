import type { FormStatusBreakdown, FormStatusMatchStatus } from "../../services/teamPlayerStatisticsService";
import {
  formatNumber,
  formatPercent,
  formatShortDate,
  formatTrainingTypes,
  matchTypeLabel,
  recencyLabel,
} from "./breakdownFormat";
import styles from "./MetricBreakdown.module.css";

type Props = {
  breakdown: FormStatusBreakdown;
  /** Estado de forma final (0-100) que muestra la barra. */
  value: number;
};

const MATCH_STATUS_LABELS: Record<FormStatusMatchStatus, string> = {
  Played: "jugó",
  NotPlayed: "convocado, no jugó",
  Absent: "no estuvo",
};

function buildFormula(b: FormStatusBreakdown, value: number): string {
  const terms: string[] = [];
  if (b.trainingComponent != null) {
    terms.push(`${formatNumber(b.trainingWeightApplied)} × ${formatPercent(b.trainingComponent)}`);
  }
  if (b.matchComponent != null) {
    terms.push(`${formatNumber(b.matchWeightApplied)} × ${formatPercent(b.matchComponent)}`);
  }
  return `(${terms.join(" + ")}) × ${formatNumber(b.fatigueFactor)} = ${formatPercent(value)}`;
}

export default function FormStatusBreakdownView({ breakdown: b, value }: Props) {
  return (
    <div className={styles.root} data-testid="form-status-breakdown">
      <section className={styles.step}>
        <h4 className={styles.stepTitle}>Entrenos ({formatPercent(b.trainingWeightNominal * 100)})</h4>
        {b.trainingComponent == null ? (
          <p className={styles.notice}>
            No hay entrenos en la ventana; el resultado se calcula solo con partidos.
          </p>
        ) : (
          <p className={styles.summary}>
            {`Recibiste ${formatNumber(b.trainingLoadReceived)} de ${formatNumber(b.trainingLoadOffered)} de carga ofrecida (${b.trainingSessionsAttended} de ${b.trainingSessionsOffered} sesiones) → ${formatPercent(b.trainingRatioComponent ?? b.trainingComponent)}`}
          </p>
        )}
        {b.trainingComponent != null && b.trainingVolumeFactor != null && b.trainingVolumeFactor < 1 && (
          <p className={styles.notice}>
            {`Llevas ${b.trainingSessionsAttended} de ${b.referenceTrainingSessions} sesiones de referencia (factor ${formatNumber(b.trainingVolumeFactor)}): el resultado se escala hasta acumular esa carga → ${formatPercent(b.trainingComponent)}`}
          </p>
        )}
        {b.trainingTypeWeightFallbackUsed && (
          <p className={styles.notice}>
            Las sesiones Técnicas puras se cuentan con peso 1: todas las sesiones cuentan igual.
          </p>
        )}
        {b.consideredTrainings.length > 0 && (
          <ul className={styles.list}>
            {b.consideredTrainings.map((t) => (
              <li key={t.eventId} className={styles.item} data-testid="form-training-item">
                <span className={styles.itemDate}>{formatShortDate(t.eventDate)}</span>
                <span>{formatTrainingTypes(t.trainingTypes)}</span>
                <span className={styles.itemMuted}>peso {formatNumber(t.typeWeight)}</span>
                <span className={styles.itemMuted}>{recencyLabel(t.recencyWeight)}</span>
                <span className={t.attended ? undefined : styles.itemBad}>
                  {t.attended ? "asistió" : `faltó: ${t.absenceReason ?? "sin motivo"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.step}>
        <h4 className={styles.stepTitle}>Partidos ({formatPercent(b.matchWeightNominal * 100)})</h4>
        {b.matchComponent == null ? (
          <p className={styles.notice}>
            No hay partidos en la ventana; el resultado se calcula solo con entrenos.
          </p>
        ) : (
          <p className={styles.summary}>
            {`Jugaste ${formatNumber(b.matchMinutesPlayedTotal, 1)}' de ${formatNumber(b.matchMinutesPossibleTotal, 1)}' posibles. Cuentan los minutos jugados sobre ${formatNumber(b.fullMatchMinutes, 1)}' de partido completo (categoría de ${b.categoryMatchMinutes}') → ${formatPercent(b.matchComponent)}`}
          </p>
        )}
        {b.consideredMatches.length > 0 && (
          <ul className={styles.list}>
            {b.consideredMatches.map((m) => (
              <li key={m.eventId} className={styles.item} data-testid="form-match-item">
                <span className={styles.itemDate}>{formatShortDate(m.eventDate)}</span>
                <span>{matchTypeLabel(m.eventTypeId)}</span>
                <span>{m.minutesPlayed}'</span>
                <span className={styles.itemMuted}>{formatPercent(m.ratio * 100)} del partido completo</span>
                <span className={styles.itemMuted}>{recencyLabel(m.recencyWeight)}</span>
                <span className={m.status === "Played" ? undefined : styles.itemBad}>
                  {MATCH_STATUS_LABELS[m.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className={styles.itemMuted}>
        {`Se miran los últimos ${b.windowDays} días: los últimos ${b.recencyFullWeightDays} días cuentan completos y después el peso se reduce a la mitad cada ${b.recencyHalfLifeDays} días.`}
        {b.excludedTrainings + b.excludedMatches > 0 &&
          ` ${b.excludedTrainings + b.excludedMatches} eventos excluidos por decisión técnica o sin resultado.`}
      </p>

      <section className={styles.step}>
        <h4 className={styles.stepTitle}>Cansancio {formatPercent(b.fatigue)}</h4>
        <p className={styles.summary}>
          {`El cansancio resta forma: factor ${formatNumber(b.fatigueFactor)} (1 − ${b.fatigue} / 200)`}
        </p>
      </section>

      <section className={styles.step}>
        <h4 className={styles.stepTitle}>Resultado</h4>
        <p className={styles.formula}>{buildFormula(b, value)}</p>
      </section>
    </div>
  );
}
