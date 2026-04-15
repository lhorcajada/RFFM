import type { PlayerEvaluation, AttributeScore } from "../../SeasonPrep";
import { GK_ALL_KEYS, FP_ALL_KEYS, SCORE_COLORS } from "../evaluationConstants";
import styles from "../EvaluationPage.module.css";

interface SummaryDotsProps {
  evaluation: PlayerEvaluation;
  isGoalkeeper: boolean;
}

export function SummaryDots({ evaluation, isGoalkeeper }: SummaryDotsProps) {
  const keys = isGoalkeeper ? GK_ALL_KEYS : FP_ALL_KEYS;
  return (
    <div className={styles.summaryDots}>
      {keys.map((k) => {
        const v = evaluation[k] as AttributeScore | undefined;
        return (
          <span
            key={k}
            className={styles.dot}
            style={{ backgroundColor: v ? SCORE_COLORS[v] : "rgba(255,255,255,0.15)" }}
          />
        );
      })}
    </div>
  );
}
