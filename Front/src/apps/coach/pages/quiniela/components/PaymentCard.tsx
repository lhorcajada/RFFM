import { Button } from "@mui/material";
import type { QuinielaPaymentMethod, QuinielaPaymentTicket } from "../../../services/quinielaService";
import { formatMoney, formatKickoff, initialsOf, paymentMethodLabel, paymentStatusLabel, roleLabel } from "../quinielaHelpers";
import styles from "./PaymentCard.module.css";

type Props = {
  ticket: QuinielaPaymentTicket;
  price: number;
  editable: boolean;
  busy: boolean;
  onPay: (method: QuinielaPaymentMethod) => void;
  onUndo: () => void;
};

const STATUS_CLASS = {
  Pending: styles.pending,
  Paid: styles.paid,
  Expired: styles.expired,
} as const;

export default function PaymentCard({ ticket, price, editable, busy, onPay, onUndo }: Props) {
  const method = paymentMethodLabel(ticket.paymentMethod);
  const detail =
    ticket.paymentStatus === "Paid" && ticket.paidAt
      ? `${method ?? "Pago"} · ${formatKickoff(ticket.paidAt)}`
      : "Boleto rellenado";
  return (
    <article className={styles.card} data-testid="payment-card">
      <div className={styles.person}>
        <span className={styles.avatar} aria-hidden="true">{initialsOf(ticket.userName)}</span>
        <span className={styles.who}>
          <span className={styles.name}>{ticket.userName}</span>
          <span className={styles.detail}>{roleLabel(ticket.role)} · {detail}</span>
        </span>
      </div>
      <div className={styles.actions}>
        <span className={styles.price}>{formatMoney(price)}</span>
        <span className={`${styles.status} ${STATUS_CLASS[ticket.paymentStatus]}`}>{paymentStatusLabel(ticket.paymentStatus) === "Pendiente de pago" ? "Pendiente" : paymentStatusLabel(ticket.paymentStatus)}</span>
        {editable && ticket.paymentStatus === "Paid" && (
          <Button variant="outlined" color="inherit" size="small" className={styles.button} disabled={busy} onClick={onUndo}>
            Deshacer
          </Button>
        )}
      </div>
      {editable && ticket.paymentStatus === "Pending" && (
        <div className={styles.payRow}>
          <span className={styles.payLabel}>Marcar como pagado</span>
          <div className={styles.payButtons}>
            <Button variant="contained" size="small" className={styles.button} disabled={busy} onClick={() => onPay("Cash")}>
              Pagado en efectivo
            </Button>
            <Button variant="contained" size="small" className={styles.button} disabled={busy} onClick={() => onPay("Bizum")}>
              Pagado por Bizum
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
