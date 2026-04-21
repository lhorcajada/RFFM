import type { PlayerEvaluation, ConceptEval } from "../../SeasonPrep";
import { FP_ALL_KEYS, GK_ALL_KEYS } from "../evaluationConstants";
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
        const v = evaluation[k] as ConceptEval | undefined;
        const filled = v?.consistencia !== undefined || v?.tendencia !== undefined;
        return (
          <span
            key={k}
            className={styles.dot}
            style={{ backgroundColor: filled ? "#4ec9b0" : "rgba(255,255,255,0.15)" }}
          />
        );
      })}
    </div>
  );
}
