import type { QuinielaMatch, QuinielaPaymentMethod, QuinielaPaymentTicket } from "../../../services/quinielaService";
import { formatMoney, initialsOf, roleLabel } from "../quinielaHelpers";
import PaymentCard from "./PaymentCard";
import styles from "./UserTicketsGroup.module.css";

type Props = {
  tickets: QuinielaPaymentTicket[];
  price: number;
  matches: QuinielaMatch[];
  editable: boolean;
  busyTicketId: string | null;
  onPay: (ticketId: string, method: QuinielaPaymentMethod) => void;
  onUndo: (ticketId: string) => void;
  onDelete: (ticket: QuinielaPaymentTicket) => void;
};

export default function UserTicketsGroup({ tickets, price, matches, editable, busyTicketId, onPay, onUndo, onDelete }: Props) {
  const owner = tickets[0];
  const count = tickets.length;
  return (
    <section className={styles.group} data-testid="user-tickets" aria-label={`Boletos de ${owner.userName}`}>
      <header className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">{initialsOf(owner.userName)}</span>
        <span className={styles.who}>
          <span className={styles.name}>{owner.userName}</span>
          <span className={styles.detail}>
            {roleLabel(owner.role)} · {count} {count === 1 ? "boleto" : "boletos"}
          </span>
        </span>
        <span className={styles.total}>{formatMoney(price * count)}</span>
      </header>
      <div className={styles.list}>
        {tickets.map((ticket) => (
          <PaymentCard
            key={ticket.id}
            ticket={ticket}
            price={price}
            matches={matches}
            editable={editable}
            busy={busyTicketId === ticket.id}
            onPay={(method) => onPay(ticket.id, method)}
            onUndo={() => onUndo(ticket.id)}
            onDelete={() => onDelete(ticket)}
          />
        ))}
      </div>
    </section>
  );
}
