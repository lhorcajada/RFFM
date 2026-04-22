import type { PlayerRating, RatingAnswer } from "../../../types/playerRating";
import {
  getCategoryLabel,
  getCharacteristicDef,
  type CategoryKey,
} from "../rating/ratingConcepts";
import styles from "./SubRatingsPanel.module.css";

function levelColor(v: number): string {
  if (v >= 8.5) return "#29b6f6";
  if (v >= 7) return "#66bb6a";
  if (v >= 5) return "#ffb300";
  return "#ef5350";
}

function groupByCat(answers: RatingAnswer[]): Record<CategoryKey, RatingAnswer[]> {
  const result: Partial<Record<CategoryKey, RatingAnswer[]>> = {};
  for (const a of answers) {
    const key = a.categoryKey as CategoryKey;
    if (!result[key]) result[key] = [];
    result[key]!.push(a);
  }
  return result as Record<CategoryKey, RatingAnswer[]>;
}

type Props = {
  rating: PlayerRating | null;
};

export default function SubRatingsPanel({ rating }: Props) {
  if (!rating) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Sin valoracion</div>
      </div>
    );
  }

  if (rating.answers.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Sin desglose de subvaloraciones</div>
      </div>
    );
  }

  const byCategory = groupByCat(rating.answers);
  const categoryKeys = Object.keys(byCategory) as CategoryKey[];

  return (
    <div className={styles.panel}>
      <div className={styles.groups}>
        {categoryKeys.map((catKey) => {
          const catAnswers = byCategory[catKey];
          const avg = catAnswers.reduce((s, a) => s + a.level, 0) / catAnswers.length;
          return (
            <div key={catKey} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupLabel}>{getCategoryLabel(catKey)}</span>
                <span className={styles.groupAvg} style={{ color: levelColor(avg) }}>
                  {Math.ceil(avg)}
                </span>
              </div>
              {catAnswers.map((answer) => (
                <div key={answer.characteristicKey} className={styles.item}>
                  <span className={styles.itemConcept}>
                    {(getCharacteristicDef(answer.characteristicKey)?.label ?? answer.characteristicKey)
                    + ": "
                    + answer.level}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
