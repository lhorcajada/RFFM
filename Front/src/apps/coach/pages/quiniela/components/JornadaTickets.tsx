import { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import { getQuinielaJornadaResults } from "../../../services/quinielaService";
import type { QuinielaJornadaResults } from "../../../services/quinielaService";
import { categoryLabel, formatMoney, ticketOwnerLabel } from "../quinielaHelpers";
import TicketPicks from "./TicketPicks";
import styles from "./JornadaTickets.module.css";

type Props = {
  teamId: string;
  jornadaId: string;
  roundNumber: number;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export default function JornadaTickets({ teamId, jornadaId, roundNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>("idle");
  const [results, setResults] = useState<QuinielaJornadaResults | null>(null);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (results) return;
    setState("loading");
    try {
      setResults(await getQuinielaJornadaResults(teamId, jornadaId));
      setState("ready");
    } catch {
      setState("error");
      setOpen(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => void handleToggle()}
      >
        {open ? `Ocultar boletos de la jornada ${roundNumber}` : `Ver boletos de la jornada ${roundNumber}`}
      </Button>
      {state === "error" && <p className={styles.note}>No se pudieron cargar los boletos. Inténtalo de nuevo.</p>}
      {open && state === "loading" && <CircularProgress size={24} aria-label="Cargando boletos" />}
      {open && results && results.tickets.length === 0 && <p className={styles.note}>No hay boletos en esta jornada.</p>}
      {open && results && results.tickets.length > 0 && (
        <ul className={styles.list}>
          {results.tickets.map((ticket) => (
            <li key={ticket.id} className={styles.ticket} data-testid="jornada-ticket">
              <div className={styles.header}>
                <span className={styles.who}>
                  <span className={styles.name}>{ticketOwnerLabel(ticket.userName, ticket.number)}</span>
                  <span className={styles.detail}>
                    {ticket.hits !== null ? `${ticket.hits} aciertos` : "Sin puntuar"}
                    {categoryLabel(ticket.category) ? ` · ${categoryLabel(ticket.category)}` : ""}
                  </span>
                </span>
                {(ticket.prize ?? 0) > 0 && <span className={styles.prize}>{formatMoney(ticket.prize ?? 0)}</span>}
              </div>
              <TicketPicks ticket={ticket} matches={results.matches} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
