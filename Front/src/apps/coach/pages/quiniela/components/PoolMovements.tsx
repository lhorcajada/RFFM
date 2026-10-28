import type { QuinielaFundMovement } from "../../../services/quinielaService";
import { formatKickoff, signedMoney } from "../quinielaHelpers";
import styles from "./PoolMovements.module.css";

type Props = {
  movements: QuinielaFundMovement[];
};

export default function PoolMovements({ movements }: Props) {
  return (
    <section className={styles.card} aria-labelledby="quiniela-movements-title">
      <h2 id="quiniela-movements-title" className={styles.label}>Movimientos de la bolsa</h2>
      {movements.length === 0 ? (
        <p className={styles.empty}>Todavía no hay movimientos.</p>
      ) : (
        <ul className={styles.list}>
          {movements.map((movement) => (
            <li key={movement.id} className={styles.item}>
              <span className={styles.text}>
                <span className={styles.title}>{movement.description ?? "Movimiento"}</span>
                <span className={styles.when}>{formatKickoff(movement.occurredAt)}</span>
              </span>
              <span className={styles.amount}>{signedMoney(movement.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
