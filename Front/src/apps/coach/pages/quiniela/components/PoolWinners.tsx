import type { QuinielaPaymentTicket } from "../../../services/quinielaService";
import { categoryLabel, formatMoney } from "../quinielaHelpers";
import styles from "./PoolWinners.module.css";

type Props = {
  tickets: QuinielaPaymentTicket[];
  carryOut: number | null;
};

const CATEGORY_ORDER = ["Special", "First", "Second", "Third"];

export default function PoolWinners({ tickets, carryOut }: Props) {
  const winners = tickets
    .filter((t) => t.category !== null && t.category !== "None")
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category ?? "") - CATEGORY_ORDER.indexOf(b.category ?? "") || (b.prize ?? 0) - (a.prize ?? 0),
    );

  return (
    <section className={styles.card} aria-labelledby="quiniela-winners-title">
      <h2 id="quiniela-winners-title" className={styles.title}>Ganadores</h2>
      {winners.length === 0 ? (
        <p className={styles.empty}>
          Sin acertantes en esta jornada{carryOut ? `: ${formatMoney(carryOut)} pasan de bote a la siguiente` : ""}.
        </p>
      ) : (
        <ul className={styles.list}>
          {winners.map((ticket) => (
            <li key={ticket.id} className={styles.row}>
              <span className={styles.who}>
                <span className={styles.name}>{ticket.userName}</span>
                <span className={styles.detail}>
                  {categoryLabel(ticket.category)} · {ticket.hits} aciertos
                </span>
              </span>
              <span className={styles.prize}>{formatMoney(ticket.prize)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
