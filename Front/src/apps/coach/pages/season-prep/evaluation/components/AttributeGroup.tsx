import type { PlayerEvaluation, ConceptEval } from "../../SeasonPrep";
import type { ConceptDef, ConceptKey } from "../evaluationConstants";
import { ConceptRow } from "./ConceptRow";
import styles from "../EvaluationPage.module.css";

interface AttributeGroupProps {
  title: string;
  concepts: ConceptDef[];
  evaluation: PlayerEvaluation;
  onChange: (key: ConceptKey, val: ConceptEval) => void;
}

export function AttributeGroup({ title, concepts, evaluation, onChange }: AttributeGroupProps) {
  return (
    <div className={styles.attrGroup}>
      <div className={styles.attrGroupTitle}>{title}</div>
      {concepts.map(({ key, ...rest }) => (
        <ConceptRow
          key={key}
          concept={{ key, ...rest }}
          value={evaluation[key] as ConceptEval | undefined}
          onChange={(val) => onChange(key, val)}
        />
      ))}
    </div>
  );
}
