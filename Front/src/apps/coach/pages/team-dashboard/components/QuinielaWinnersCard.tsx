import { useId, useState } from "react";
import { Link } from "react-router-dom";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { QuinielaPrevious } from "../../../services/quinielaService";
import {
  categoryLabel,
  formatJornadaDay,
  formatMoney,
  quinielaHistoryHref,
  ticketOwnerLabel,
} from "../../quiniela/quinielaHelpers";
import styles from "./QuinielaWinnersCard.module.css";

export default function QuinielaWinnersCard({
  previous,
  teamId,
}: {
  previous: QuinielaPrevious;
  teamId: string;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const myPrize = previous.myPrize ?? 0;
  const day = formatJornadaDay(previous.firstKickoffUtc);
  const title = `Resultados de la quiniela - Jornada ${previous.roundNumber}${day ? ` día ${day}` : ""}`;
  return (
    <section aria-label="Resultados de la quiniela" className={styles.card}>
      <h2 className={styles.heading}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.icon} aria-hidden="true">
            <EmojiEventsOutlinedIcon fontSize="inherit" />
          </span>
          <span className={styles.title}>{title}</span>
          <ExpandMoreIcon
            className={open ? styles.chevronOpen : styles.chevron}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className={styles.body}>
          {myPrize > 0 && (
            <p className={styles.mine}>
              Tu premio: <strong>{formatMoney(myPrize)}</strong>
              {categoryLabel(previous.myCategory)
                ? ` · ${categoryLabel(previous.myCategory)}`
                : ""}
              {previous.myHits !== null ? ` · ${previous.myHits} aciertos` : ""}
            </p>
          )}
          {previous.winners.length === 0 ? (
            <p className={styles.empty}>
              Sin acertantes en esta jornada.
              {previous.carryOut > 0
                ? ` El bote de ${formatMoney(previous.carryOut)} pasa a la siguiente.`
                : ""}
            </p>
          ) : (
            <ul className={styles.list}>
              {previous.winners.map((winner, index) => (
                <li
                  key={`${winner.userName}-${winner.ticketNumber}-${index}`}
                  className={winner.isMine ? styles.rowMine : styles.row}
                >
                  <span className={styles.who}>
                    <span className={styles.name}>
                      {ticketOwnerLabel(winner.userName, winner.ticketNumber)}
                    </span>
                    <span className={styles.detail}>
                      {categoryLabel(winner.category)} · {winner.hits} aciertos
                    </span>
                  </span>
                  <span className={styles.prize}>
                    {formatMoney(winner.prize)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to={quinielaHistoryHref(teamId)} className={styles.history}>
            Ver histórico
          </Link>
        </div>
      )}
    </section>
  );
}
