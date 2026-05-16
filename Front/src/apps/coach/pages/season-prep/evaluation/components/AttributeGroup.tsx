import type { PlayerRating, RatingAnswer } from "../../../../types/playerRating";
import type { CharacteristicDef } from "../evaluationConstants";
import { ConceptRow } from "./ConceptRow";
import styles from "../EvaluationPage.module.css";

interface AttributeGroupProps {
  title: string;
  concepts: CharacteristicDef[];
  rating: PlayerRating;
  onChange: (answer: RatingAnswer) => void;
}

export function AttributeGroup({ title, concepts, rating, onChange }: AttributeGroupProps) {
  return (
    <div className={styles.attrGroup}>
      <div className={styles.attrGroupTitle}>{title}</div>
      {concepts.map((concept) => (
        <ConceptRow
          key={concept.key}
          concept={concept}
          value={rating.answers.find((answer) => answer.characteristicKey === concept.key)}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
