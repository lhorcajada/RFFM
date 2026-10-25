import type { ClassificationTeam } from "../../../../../shared/hooks/useClassification";
import PositionBadge from "./PositionBadge";
import styles from "./MyTeamSummary.module.css";

type MyTeamSummaryProps = {
  team: ClassificationTeam;
  gapText: string;
};

export default function MyTeamSummary({ team, gapText }: MyTeamSummaryProps) {
  return (
    <section className={styles.summary} aria-label="Tu equipo">
      <PositionBadge position={team.position} size="large" suffix="º" />
      <div className={styles.info}>
        <span className={styles.name}>{team.teamName}</span>
        {gapText && <span className={styles.gap}>{gapText}</span>}
      </div>
      <div className={styles.points}>
        <span className={styles.pointsValue}>{team.points}</span>
        <span className={styles.pointsLabel}>puntos</span>
      </div>
    </section>
  );
}
