import { Link } from "react-router-dom";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import type { QuinielaPrevious } from "../../../services/quinielaService";
import { categoryLabel, formatMoney, quinielaHistoryHref, ticketOwnerLabel } from "../../quiniela/quinielaHelpers";
import styles from "./QuinielaWinnersCard.module.css";

export default function QuinielaWinnersCard({ previous, teamId }: { previous: QuinielaPrevious; teamId: string }) {
  const myPrize = previous.myPrize ?? 0;
  return (
    <section aria-label="Ganadores de la quiniela" className={styles.card}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          <EmojiEventsOutlinedIcon fontSize="inherit" />
        </span>
        <div className={styles.headline}>
          <h2 className={styles.title}>Ganadores de la quiniela</h2>
          <span className={styles.round}>Jornada {previous.roundNumber}</span>
        </div>
      </div>
      {myPrize > 0 && (
        <p className={styles.mine}>
          Tu premio: <strong>{formatMoney(myPrize)}</strong>
          {categoryLabel(previous.myCategory) ? ` · ${categoryLabel(previous.myCategory)}` : ""}
          {previous.myHits !== null ? ` · ${previous.myHits} aciertos` : ""}
        </p>
      )}
      {previous.winners.length === 0 ? (
        <p className={styles.empty}>
          Sin acertantes en esta jornada.
          {previous.carryOut > 0 ? ` El bote de ${formatMoney(previous.carryOut)} pasa a la siguiente.` : ""}
        </p>
      ) : (
        <ul className={styles.list}>
          {previous.winners.map((winner, index) => (
            <li key={`${winner.userName}-${winner.ticketNumber}-${index}`} className={winner.isMine ? styles.rowMine : styles.row}>
              <span className={styles.who}>
                <span className={styles.name}>{ticketOwnerLabel(winner.userName, winner.ticketNumber)}</span>
                <span className={styles.detail}>
                  {categoryLabel(winner.category)} · {winner.hits} aciertos
                </span>
              </span>
              <span className={styles.prize}>{formatMoney(winner.prize)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to={quinielaHistoryHref(teamId)} className={styles.history}>
        Ver histórico
      </Link>
    </section>
  );
}
