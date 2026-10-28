import type { QuinielaPool } from "../../../services/quinielaService";
import { formatMoney } from "../quinielaHelpers";
import styles from "./PoolSummary.module.css";

type Props = {
  pool: QuinielaPool;
  carryIn: number;
};

export default function PoolSummary({ pool, carryIn }: Props) {
  const ticketsLabel = pool.paidTickets === 1 ? "boleto pagado" : "boletos pagados";
  return (
    <section className={styles.card} aria-labelledby="quiniela-pool-title">
      <h2 id="quiniela-pool-title" className={styles.label}>Bolsa de la jornada</h2>
      <span className={styles.amount}>{formatMoney(pool.prizePool)}</span>
      <p className={styles.detail}>
        {pool.paidTickets} {ticketsLabel} ({formatMoney(pool.collected)}) más {formatMoney(carryIn)} de bote de la jornada anterior.
      </p>
      <p className={styles.participants}>{pool.participants} participantes · jugadores, familiares y entrenador</p>
    </section>
  );
}
