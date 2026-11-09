import { useId } from "react";
import styles from "./ScorersRoundSelector.module.css";

type Props = {
  rounds: number[];
  selected: number;
  onSelect: (round: number) => void;
};

export default function ScorersRoundSelector({ rounds, selected, onSelect }: Props) {
  const id = useId();

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        Jornada
      </label>
      <select
        id={id}
        className={styles.select}
        value={String(selected)}
        onChange={(event) => onSelect(Number(event.target.value))}
      >
        {rounds.map((round) => (
          <option key={round} value={String(round)}>
            {`Jornada ${round}`}
          </option>
        ))}
      </select>
    </div>
  );
}
