import { CircularProgress } from "@mui/material";
import type { QuinielaTicket } from "../../../services/quinielaService";
import { formatKickoff, ticketPaymentLabel } from "../quinielaHelpers";
import styles from "./TicketList.module.css";

type Props = {
  tickets: QuinielaTicket[];
  totalMatches: number;
  picksOpen: boolean;
  canCreate: boolean;
  walletBlockedReason: string | null;
  payingTicketId: string | null;
  deletingTicketId: string | null;
  onCreate: () => void;
  onEdit: (ticket: QuinielaTicket) => void;
  onDelete: (ticket: QuinielaTicket) => void;
  onPayWithWallet: (ticket: QuinielaTicket) => void;
};

export function canDeleteTicket(ticket: QuinielaTicket, picksOpen: boolean): boolean {
  const paidOutsideWallet = ticket.paymentStatus === "Paid" && ticket.paymentMethod !== "Wallet";
  return picksOpen && !paidOutsideWallet;
}

export default function TicketList({
  tickets,
  totalMatches,
  picksOpen,
  canCreate,
  walletBlockedReason,
  payingTicketId,
  deletingTicketId,
  onCreate,
  onEdit,
  onDelete,
  onPayWithWallet,
}: Props) {
  return (
    <section className={styles.wrapper} aria-labelledby="quiniela-my-tickets">
      <div className={styles.head}>
        <h2 id="quiniela-my-tickets" className={styles.heading}>
          Mis boletos ({tickets.length})
        </h2>
        {canCreate && (
          <button type="button" className={styles.create} onClick={onCreate}>
            + Crear boleto
          </button>
        )}
      </div>

      {tickets.map((ticket) => {
        const paid = ticket.paymentStatus === "Paid";
        const manualPayment = paid && ticket.paymentMethod !== "Wallet";
        const canPay = ticket.paymentStatus === "Pending" && picksOpen;
        const statusClass = paid ? styles.paid : ticket.paymentStatus === "Expired" ? styles.expired : styles.pending;
        return (
          <article key={ticket.id} className={`${styles.ticket} ${paid ? "" : styles.ticketPending}`}>
            <div className={styles.ticketHead}>
              <h3 className={styles.ticketTitle}>Boleto {ticket.number}</h3>
              <span className={`${styles.status} ${statusClass}`}>
                {ticketPaymentLabel(ticket.paymentStatus, ticket.paymentMethod)}
              </span>
            </div>
            <p className={styles.meta}>
              {ticket.picks.length} de {totalMatches} partidos pronosticados
              {ticket.paymentStatus === "Pending" && ticket.paymentDeadlineUtc
                ? ` · paga antes del ${formatKickoff(ticket.paymentDeadlineUtc)}`
                : ""}
            </p>

            {canPay && (
              <>
                <button
                  type="button"
                  className={styles.pay}
                  disabled={walletBlockedReason !== null || payingTicketId === ticket.id}
                  aria-label={`Pagar con monedero el boleto ${ticket.number}`}
                  onClick={() => onPayWithWallet(ticket)}
                >
                  {payingTicketId === ticket.id ? <CircularProgress size={20} color="inherit" /> : "Pagar con monedero"}
                </button>
                {walletBlockedReason && <p className={styles.note}>{walletBlockedReason}</p>}
              </>
            )}

            {picksOpen && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.edit}
                  aria-label={`Modificar boleto ${ticket.number}`}
                  onClick={() => onEdit(ticket)}
                >
                  Modificar
                </button>
                {canDeleteTicket(ticket, picksOpen) && (
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={deletingTicketId === ticket.id}
                    aria-label={`Eliminar boleto ${ticket.number}`}
                    onClick={() => onDelete(ticket)}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            )}

            {manualPayment && picksOpen && (
              <p className={styles.note}>
                Este boleto se pagó en mano o por Bizum: si quieres eliminarlo, pídeselo al entrenador.
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
