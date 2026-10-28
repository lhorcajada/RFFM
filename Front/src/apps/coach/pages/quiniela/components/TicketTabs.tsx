import type { QuinielaTicket } from "../../../services/quinielaService";
import styles from "./TicketTabs.module.css";

export const NEW_TICKET = "new";

type Props = {
  tickets: QuinielaTicket[];
  selectedId: string;
  canCreate: boolean;
  onSelect: (ticketId: string) => void;
};

export default function TicketTabs({ tickets, selectedId, canCreate, onSelect }: Props) {
  return (
    <div role="group" aria-label="Mis boletos" className={styles.tabs}>
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          type="button"
          aria-pressed={selectedId === ticket.id}
          className={`${styles.tab} ${selectedId === ticket.id ? styles.selected : ""}`}
          onClick={() => onSelect(ticket.id)}
        >
          Boleto {ticket.number}
        </button>
      ))}
      {canCreate && (
        <button
          type="button"
          aria-pressed={selectedId === NEW_TICKET}
          className={`${styles.tab} ${styles.add} ${selectedId === NEW_TICKET ? styles.selected : ""}`}
          onClick={() => onSelect(NEW_TICKET)}
        >
          + Nuevo boleto
        </button>
      )}
    </div>
  );
}
