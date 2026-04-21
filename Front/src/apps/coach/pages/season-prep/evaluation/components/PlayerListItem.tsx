import type { PoolPlayer, RecruitmentStatus } from "../../SeasonPrep";
import { usePlayerAvgScore } from "../hooks/usePlayerAvgScore";
import styles from "./PlayerListItem.module.css";

const STATUS_COLOR: Record<RecruitmentStatus, string> = {
  observando:  "#9e9e9e",
  interesado:  "#4d9de0",
  fichado:     "#22c55e",
  descartado:  "#ef4444",
};

interface PlayerListItemProps {
  player: PoolPlayer;
  selected: boolean;
  onSelect: () => void;
}

export function PlayerListItem({ player, selected, onSelect }: PlayerListItemProps) {
  const { filled, total } = usePlayerAvgScore(player);
  const statusColor = STATUS_COLOR[player.recruitmentStatus ?? "observando"];
  const complete = filled === total && total > 0;
  const partial = filled > 0 && !complete;

  return (
    <button
      type="button"
      className={`${styles.item} ${selected ? styles.itemSelected : ""}`}
      onClick={onSelect}
    >
      <span
        className={styles.statusBar}
        style={{ backgroundColor: statusColor }}
        aria-hidden
      />

      <span className={styles.info}>
        {player.jerseyNumber != null &&
          player.jerseyNumber !== "" &&
          player.jerseyNumber !== "0" && (
            <span className={styles.dorsal}>{player.jerseyNumber}</span>
          )}
        <span className={styles.name}>{player.name}</span>
        {player.position && (
          <span className={styles.pos}>{player.position}</span>
        )}
      </span>

      <span
        className={styles.badge}
        style={{
          color: complete ? "#4ec9b0" : partial ? "#f59e0b" : "rgba(255,255,255,0.3)",
          borderColor: complete ? "#4ec9b0" : partial ? "#f59e0b" : "rgba(255,255,255,0.15)",
        }}
      >
        {filled}/{total}
      </span>
    </button>
  );
}
