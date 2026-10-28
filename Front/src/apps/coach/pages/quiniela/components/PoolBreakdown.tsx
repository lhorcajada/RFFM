import { LinearProgress } from "@mui/material";
import type { QuinielaTotals } from "../../../services/quinielaService";
import { formatMoney } from "../quinielaHelpers";
import styles from "./PoolBreakdown.module.css";

type Props = {
  totals: QuinielaTotals;
};

export default function PoolBreakdown({ totals }: Props) {
  const total = totals.prizePool + totals.fundAmount;
  const prizeShare = total > 0 ? Math.round((totals.prizePool / total) * 100) : 0;
  return (
    <section className={styles.card} aria-labelledby="quiniela-breakdown-title">
      <h2 id="quiniela-breakdown-title" className={styles.label}>Bolsa total</h2>
      <span className={styles.amount}>{formatMoney(total)}</span>
      <LinearProgress
        variant="determinate"
        value={prizeShare}
        aria-label="Parte de la bolsa destinada a premios"
        className={styles.bar}
      />
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Premios (incluye bote)</dt>
          <dd>{formatMoney(totals.prizePool)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Fondo del equipo</dt>
          <dd>{formatMoney(totals.fundAmount)}</dd>
        </div>
        <div className={styles.row}>
          <dt>Aún por cobrar</dt>
          <dd>{formatMoney(totals.pending)}</dd>
        </div>
      </dl>
    </section>
  );
}
