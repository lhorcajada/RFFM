import type { PlayerRating } from "../../../../types/playerRating";
import { FP_ALL_KEYS, GK_ALL_KEYS } from "../evaluationConstants";
import styles from "../EvaluationPage.module.css";

interface SummaryDotsProps {
  rating: PlayerRating;
  isGoalkeeper: boolean;
}

export function SummaryDots({ rating, isGoalkeeper }: SummaryDotsProps) {
  const keys = isGoalkeeper ? GK_ALL_KEYS : FP_ALL_KEYS;
  const answers = new Set(rating.answers.map((a) => a.characteristicKey));
  return (
    <div className={styles.summaryDots}>
      {keys.map((k) => {
        const filled = answers.has(k);
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
