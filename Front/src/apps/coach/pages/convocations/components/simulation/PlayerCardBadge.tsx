import type { CardStatus } from "../../utils/expulsions";
import styles from "./PlayerCardBadge.module.css";

interface PlayerCardBadgeProps {
  status: CardStatus;
}

/** Cards shown to a player in the current match, drawn over their photo. */
export default function PlayerCardBadge({ status }: PlayerCardBadgeProps) {
  if (status === "none") return null;

  const showsYellow = status === "yellow" || status === "doubleYellow";
  const showsRed = status === "red" || status === "doubleYellow";

  return (
    <span className={styles.badge}>
      {showsYellow && <span role="img" aria-label="Tarjeta amarilla" className={`${styles.card} ${styles.yellow}`} />}
      {showsRed && <span role="img" aria-label="Tarjeta roja" className={`${styles.card} ${styles.red}`} />}
    </span>
  );
}
