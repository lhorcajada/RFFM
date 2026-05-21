import styles from "../SeasonAccess.module.css";
import type { ClubTeamCard } from "../helpers/seasonAccess.helpers";

type Props = {
  team: ClubTeamCard;
  selected: boolean;
  onSelect: () => void;
};

export default function TeamCard({ team, selected, onSelect }: Props) {
  const positionLabel =
    typeof team.position === "number" && Number.isFinite(team.position)
      ? `${team.position}º puesto`
      : null;

  return (
    <button
      type="button"
      className={`${styles.teamCard} ${selected ? styles.teamCardSelected : ""}`}
      title={team.teamName}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className={styles.teamBody}>
        <div className={styles.teamName}>{team.teamName}</div>
        <div className={styles.teamCategory}>{team.categoryDescription}</div>
        {positionLabel ? <div className={styles.teamPosition}>{positionLabel}</div> : null}
      </div>
    </button>
  );
}
