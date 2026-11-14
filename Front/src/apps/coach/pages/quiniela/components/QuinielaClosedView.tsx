import { useMemo, useState } from "react";
import type { QuinielaMatch, QuinielaTicket } from "../../../services/quinielaService";
import QuinielaMatchList from "../../team-dashboard/components/QuinielaMatchList";
import {
  buildQuinielaMatchRows,
  describeTicketSummary,
  summarizeTickets,
} from "../../team-dashboard/utils/quinielaMatchResults";
import { goalsToLabel, ticketPaymentLabel } from "../quinielaHelpers";
import styles from "./QuinielaClosedView.module.css";

type Props = {
  matches: QuinielaMatch[];
  tickets: QuinielaTicket[];
};

function TicketSection({
  ticket,
  matches,
  pleno,
  defaultOpen,
}: {
  ticket: QuinielaTicket;
  matches: QuinielaMatch[];
  pleno: QuinielaMatch | undefined;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rows = useMemo(() => buildQuinielaMatchRows(matches, [ticket], new Date()), [matches, ticket]);
  const participates = ticket.paymentStatus === "Paid";
  const summary = summarizeTickets(rows, [ticket])[0];
  const subtitle = !participates
    ? "Sin pagar · no participa en esta jornada"
    : summary && summary.played > 0
      ? describeTicketSummary(summary)
      : "Aún no se ha jugado ningún partido";
  const panelId = `quiniela-closed-ticket-${ticket.id}`;

  return (
    <section className={styles.ticket} aria-label={`Boleto ${ticket.number}`}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.headerText}>
          <span className={styles.titleRow}>
            <span className={styles.title}>Boleto {ticket.number}</span>
            <span className={`${styles.status} ${participates ? styles.paid : styles.pending}`}>
              {ticketPaymentLabel(ticket.paymentStatus, ticket.paymentMethod)}
            </span>
          </span>
          <span className={participates ? styles.summary : styles.muted}>{subtitle}</span>
        </span>
        <span aria-hidden="true" className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
          <QuinielaMatchList rows={rows} summaries={[]} />
          {pleno && (
            <div className={styles.pleno}>
              <span className={styles.plenoTitle}>
                Pleno al 15 · {pleno.homeTeam} - {pleno.awayTeam}
              </span>
              <span>
                Tu pronóstico{" "}
                <strong>
                  {goalsToLabel(ticket.plenoHome)} - {goalsToLabel(ticket.plenoAway)}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function QuinielaClosedView({ matches, tickets }: Props) {
  const pleno = matches.find((m) => m.isValid && m.isPleno);
  const noTicketRows = useMemo(() => buildQuinielaMatchRows(matches, [], new Date()), [matches]);

  if (tickets.length === 0) {
    return (
      <div className={styles.stack}>
        <p className={styles.noTicket}>No participas en esta jornada: no tienes ningún boleto.</p>
        <div className={styles.panelAlone}>
          <QuinielaMatchList rows={noTicketRows} summaries={[]} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {tickets.map((ticket, index) => (
        <TicketSection key={ticket.id} ticket={ticket} matches={matches} pleno={pleno} defaultOpen={index === 0} />
      ))}
    </div>
  );
}
