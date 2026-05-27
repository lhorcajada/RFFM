import styles from "./PlayerCromo.module.css";

export type SeasonAccessPlayer = {
  id: string;
  displayName: string;
  playerName?: string;
  teamName: string;
  teamCode?: string;
  category: string;
  birthYear?: number | null;
  possibleDemarcationIds?: number[];
  idealDemarcationId?: number | null;
  totalGoals?: number | null;
  federationPlayerCode?: string;
  age?: number | null;
  status?: string | null;
  removedFromDate?: string | null;
};

type Props = {
  player: SeasonAccessPlayer;
  selected?: boolean;
  onSelect?: () => void;
};

export default function PlayerCromo({ player, selected = false, onSelect }: Props) {
  const initial = player.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <button
      type="button"
      className={`${styles.playerCard} ${selected ? styles.playerCardSelected : ""}`}
      title={player.displayName}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className={styles.playerAvatarWrap}>
        <div className={styles.playerAvatarInitial}>{initial}</div>
      </div>

      <div className={styles.playerBody}>
        <div className={styles.playerName}>{player.displayName}</div>
        <div className={styles.playerCategory}>{player.category}</div>
        <div className={styles.playerMeta}>{player.teamName}</div>
        <div className={styles.playerAge}>{player.age != null ? `${player.age} años` : "Edad no disponible"}</div>
        <div className={styles.playerGoals}>{player.totalGoals != null ? `${player.totalGoals} goles` : "Goles no disponibles"}</div>
      </div>
    </button>
  );
}
