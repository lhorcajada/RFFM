import { useMemo } from "react";
import styles from "./SquadSummary.module.css";

type SummaryPlayer = {
  position?: string | null;
  isInjured?: boolean;
};

type Props = {
  players: SummaryPlayer[];
};

export default function SquadSummary({ players }: Props) {
  const figures = useMemo(() => {
    return [
      { label: "Jugadores", value: players.length },
      { label: "Lesionados", value: players.filter((p) => p.isInjured === true).length },
    ];
  }, [players]);

  return (
    <div className={styles.summary}>
      {figures.map(({ label, value }) => (
        <div key={label} className={styles.figure}>
          <span className={styles.value}>{value}</span>
          <span className={styles.label}>{label}</span>
        </div>
      ))}
    </div>
  );
}
