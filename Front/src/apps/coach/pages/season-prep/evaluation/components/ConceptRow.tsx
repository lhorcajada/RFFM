import type { CharacteristicDef } from "../evaluationConstants";
import type { RatingAnswer } from "../../../../types/playerRating";
import styles from "../EvaluationPage.module.css";

interface ConceptRowProps {
  concept: CharacteristicDef;
  value: RatingAnswer | undefined;
  onChange: (val: RatingAnswer) => void;
}

export function ConceptRow({ concept, value, onChange }: ConceptRowProps) {
  return (
    <div className={styles.conceptRow}>
      <div className={styles.conceptHeader}>
        <span className={styles.conceptLabel}>{concept.label}</span>
        <span className={styles.conceptDescriptor}>{concept.levels[value?.level ? value.level - 1 : 0]?.concept ?? ""}</span>
      </div>

      <div className={styles.pillRow}>
        <div className={styles.pillGroup}>
          {concept.levels.map((levelDef) => {
            const isActive = value?.level === levelDef.level;
            return (
            <button
              key={levelDef.level}
              className={`${styles.conceptPill} ${isActive ? styles.conceptPillActive : ""}`}
              aria-label={`Nivel ${levelDef.level}: ${levelDef.concept}`}
              title={levelDef.concept}
              onClick={() => onChange({
                characteristicKey: concept.key,
                categoryKey: concept.categoryKey,
                level: levelDef.level,
                concept: levelDef.concept,
              })}
              type="button"
            >
              <span className={styles.conceptPillLevel}>{levelDef.level}</span>
              <span className={styles.conceptPillText}>{levelDef.concept}</span>
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
