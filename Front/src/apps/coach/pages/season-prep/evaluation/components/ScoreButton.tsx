import type { AttributeScore } from "../evaluationConstants";
import { SCORE_COLORS, SCORE_LABEL } from "../evaluationConstants";
import styles from "../EvaluationPage.module.css";

interface ScoreButtonProps {
  value: AttributeScore;
  active: boolean;
  onClick: () => void;
}

export function ScoreButton({ value, active, onClick }: ScoreButtonProps) {
  return (
    <button
      className={`${styles.scoreBtn} ${active ? styles.scoreBtnActive : ""}`}
      style={
        active
          ? { backgroundColor: SCORE_COLORS[value], borderColor: SCORE_COLORS[value] }
          : { borderColor: SCORE_COLORS[value] }
      }
      title={SCORE_LABEL[value]}
      onClick={onClick}
    >
      {value}
    </button>
  );
}
