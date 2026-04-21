import type { ConceptDef, ConceptEval } from "../evaluationConstants";
import styles from "../EvaluationPage.module.css";

interface ConceptRowProps {
  concept: ConceptDef;
  value: ConceptEval | undefined;
  onChange: (val: ConceptEval) => void;
}

export function ConceptRow({ concept, value, onChange }: ConceptRowProps) {
  function toggleConsistencia(option: string) {
    const next = value?.consistencia === option ? undefined : option;
    onChange({ ...value, consistencia: next });
  }

  function toggleTendencia(option: string) {
    const next = value?.tendencia === option ? undefined : option;
    onChange({ ...value, tendencia: next });
  }

  return (
    <div className={styles.conceptRow}>
      <div className={styles.conceptHeader}>
        <span className={styles.conceptLabel}>{concept.label}</span>
        <span className={styles.conceptDescriptor}>{concept.descriptor}</span>
      </div>

      <div className={styles.pillRow}>
        <span className={styles.pillRowLabel}>Consistencia</span>
        <div className={styles.pillGroup}>
          {concept.consistenciaOptions.map((opt) => (
            <button
              key={opt}
              className={`${styles.conceptPill} ${styles.conceptPillConsistencia} ${
                value?.consistencia === opt ? styles.conceptPillActive : ""
              }`}
              onClick={() => toggleConsistencia(opt)}
              type="button"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.pillRow}>
        <span className={styles.pillRowLabel}>Tendencia</span>
        <div className={styles.pillGroup}>
          {concept.tendenciaOptions.map((opt) => (
            <button
              key={opt}
              className={`${styles.conceptPill} ${styles.conceptPillTendencia} ${
                value?.tendencia === opt ? styles.conceptPillActive : ""
              }`}
              onClick={() => toggleTendencia(opt)}
              type="button"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
