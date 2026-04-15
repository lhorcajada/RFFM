import type { PlayerEvaluation, AttributeScore } from "../../SeasonPrep";
import type { AttributeKey } from "../evaluationConstants";
import { ALL_SCORES } from "../evaluationConstants";
import { ScoreButton } from "./ScoreButton";
import styles from "../EvaluationPage.module.css";

interface AttributeGroupProps {
  title: string;
  attrs: { key: AttributeKey; label: string }[];
  evaluation: PlayerEvaluation;
  onChange: (key: AttributeKey, val: AttributeScore) => void;
}

export function AttributeGroup({ title, attrs, evaluation, onChange }: AttributeGroupProps) {
  return (
    <div className={styles.attrGroup}>
      <div className={styles.attrGroupTitle}>{title}</div>
      {attrs.map(({ key, label }) => (
        <div key={key} className={styles.attrRow}>
          <span className={styles.attrLabel}>{label}</span>
          <div className={styles.scoreBtns}>
            {ALL_SCORES.map((v) => (
              <ScoreButton
                key={v}
                value={v}
                active={evaluation[key] === v}
                onClick={() => onChange(key, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
