import { CircularProgress, LinearProgress } from "@mui/material";
import type { QuinielaPaymentStatus } from "../../../services/quinielaService";
import { formatKickoff, formatMoney, paymentStatusLabel } from "../quinielaHelpers";
import styles from "./TicketSummary.module.css";

type Props = {
  filled: number;
  total: number;
  price: number;
  paymentStatus: QuinielaPaymentStatus | null;
  paymentDeadlineUtc: string | null;
  closed: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
};

export default function TicketSummary({
  filled,
  total,
  price,
  paymentStatus,
  paymentDeadlineUtc,
  closed,
  saving,
  canSave,
  onSave,
}: Props) {
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  const statusClass = paymentStatus === "Paid" ? styles.paid : paymentStatus === "Expired" ? styles.expired : styles.pending;
  return (
    <section className={styles.card} aria-labelledby="quiniela-ticket-title">
      <div className={styles.head}>
        <h2 id="quiniela-ticket-title" className={styles.title}>Tu boleto</h2>
        {paymentStatus ? (
          <span className={`${styles.status} ${statusClass}`}>{paymentStatusLabel(paymentStatus)}</span>
        ) : (
          <span className={`${styles.status} ${styles.pending}`}>Sin guardar</span>
        )}
      </div>
      <div className={styles.progress}>
        <div className={styles.progressLabel}>
          <span>Completado</span>
          <strong>{filled} de {total}</strong>
        </div>
        <LinearProgress
          variant="determinate"
          value={percent}
          className={styles.track}
          aria-label="Boleto completado"
        />
      </div>
      <div className={styles.price}>
        <span>Precio del boleto</span>
        <strong className={styles.priceValue}>{formatMoney(price)}</strong>
      </div>
      <button type="button" className={styles.save} disabled={!canSave || saving || closed} onClick={onSave}>
        {saving ? <CircularProgress size={20} color="inherit" /> : "Guardar boleto"}
      </button>
      {paymentDeadlineUtc && (
        <p className={styles.note}>
          Puedes guardar el boleto y pagar después: el plazo termina el {formatKickoff(paymentDeadlineUtc)}. El pago se entrega al entrenador.
        </p>
      )}
    </section>
  );
}
