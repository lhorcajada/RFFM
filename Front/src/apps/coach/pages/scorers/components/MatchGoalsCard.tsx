import type { LeagueGoal, LeagueMatch } from "../../../services/leagueScorersService";
import styles from "./MatchGoalsCard.module.css";

const GOAL_TAGS: Partial<Record<LeagueGoal["type"], string>> = {
  penalty: "Penalti",
  ownGoal: "En propia",
};

function GoalRow({ goal }: { goal: LeagueGoal }) {
  const tag = GOAL_TAGS[goal.type];
  return (
    <li className={styles.goal}>
      <span className={styles.minute}>{goal.minute || "–"}</span>
      <span className={styles.goalText}>
        <span className={styles.playerLine}>
          <span className={styles.player}>{goal.player}</span>
          {goal.seasonGoals !== null && <span className={styles.total}>{`(${goal.seasonGoals})`}</span>}
        </span>
        <span className={styles.team}>{goal.team}</span>
      </span>
      {tag && <span className={styles.tag}>{tag}</span>}
    </li>
  );
}

export default function MatchGoalsCard({ match }: { match: LeagueMatch }) {
  const when = [match.date, match.time].filter(Boolean).join(" · ");

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div className={styles.info}>
          <span className={styles.when}>{when}</span>
          <h3 className={styles.title}>{`${match.home} ${match.homeGoals} – ${match.awayGoals} ${match.away}`}</h3>
        </div>
        {match.isOwnTeam && <span className={styles.ownTag}>Mi equipo</span>}
      </header>
      {match.pendingActa ? (
        <p className={styles.note}>Acta pendiente</p>
      ) : match.goals.length === 0 ? (
        <p className={styles.note}>Sin goles</p>
      ) : (
        <ul className={styles.goals}>
          {match.goals.map((goal, index) => (
            <GoalRow key={`${goal.minute}-${goal.player}-${index}`} goal={goal} />
          ))}
        </ul>
      )}
    </article>
  );
}
