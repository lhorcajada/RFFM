import type { LeagueScorer } from "../../../services/leagueScorersService";
import styles from "./ScorersRanking.module.css";

type Props = {
  scorers: LeagueScorer[];
  round: number;
};

export default function ScorersRanking({ scorers, round }: Props) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Máximos goleadores</h2>
      {scorers.length === 0 ? (
        <p className={styles.note}>Todavía no hay goles registrados.</p>
      ) : (
        <ol className={styles.list}>
          {scorers.map((scorer) => (
            <li key={`${scorer.rank}-${scorer.player}`} className={styles.row}>
              <span className={`${styles.rank} ${scorer.rank === 1 ? styles.leader : ""}`}>{scorer.rank}</span>
              <span className={styles.who}>
                <span className={styles.player}>{scorer.player}</span>
                <span className={styles.team}>{scorer.team}</span>
              </span>
              <span className={styles.goals}>{scorer.goals}</span>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.note}>{`Clasificación acumulada hasta la jornada ${round}.`}</p>
    </section>
  );
}
