import { useEffect, useState } from "react";
import { Autocomplete, Button, Drawer, Stack, TextField, Typography } from "@mui/material";
import { searchPlayers } from "../lotteryHelpers";
import type { LotteryCardPlayer } from "./LotteryPlayerCard";
import styles from "./LotterySheet.module.css";

export type AssignBookValues = {
  teamPlayerId: string | null;
  bookNumber: number;
  firstTicketNumber: number;
  lastTicketNumber: number;
};

type Props = {
  open: boolean;
  /** "assign" pide jugador; "edit" solo corrige los tres números del taco. */
  mode: "assign" | "edit";
  title: string;
  submitLabel: string;
  players: LotteryCardPlayer[];
  initial: AssignBookValues;
  ticketsPerBook: number;
  processing: boolean;
  onClose: () => void;
  onSubmit: (values: AssignBookValues) => void;
};

const playerLabel = (player: LotteryCardPlayer) => `${player.dorsal ?? "–"} · ${player.alias || player.name}`;

export default function AssignBookSheet({
  open,
  mode,
  title,
  submitLabel,
  players,
  initial,
  ticketsPerBook,
  processing,
  onClose,
  onSubmit,
}: Props) {
  const [playerId, setPlayerId] = useState<string | null>(initial.teamPlayerId);
  const [bookNumber, setBookNumber] = useState(String(initial.bookNumber));
  const [firstTicket, setFirstTicket] = useState(String(initial.firstTicketNumber));
  const [lastTicket, setLastTicket] = useState(String(initial.lastTicketNumber));
  const [lastEdited, setLastEdited] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlayerId(initial.teamPlayerId);
    setBookNumber(String(initial.bookNumber));
    setFirstTicket(String(initial.firstTicketNumber));
    setLastTicket(String(initial.lastTicketNumber));
    setLastEdited(false);
  }, [open, initial.teamPlayerId, initial.bookNumber, initial.firstTicketNumber, initial.lastTicketNumber]);

  const parsedBook = Number.parseInt(bookNumber, 10);
  const parsedFirst = Number.parseInt(firstTicket, 10);
  const parsedLast = Number.parseInt(lastTicket, 10);
  const numbersValid = parsedBook > 0 && parsedFirst >= 0 && parsedLast >= parsedFirst;
  const isValid = numbersValid && (mode === "edit" || playerId !== null);
  const selectedPlayer = players.find((p) => p.id === playerId) ?? null;

  const changeFirstTicket = (value: string) => {
    setFirstTicket(value);
    const parsed = Number.parseInt(value, 10);
    if (!lastEdited && parsed >= 0) setLastTicket(String(parsed + ticketsPerBook - 1));
  };

  const changeLastTicket = (value: string) => {
    setLastTicket(value);
    setLastEdited(true);
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{ className: styles.sheet, role: "dialog", "aria-label": title }}
    >
      <Typography variant="h6" className={styles.title}>
        {title}
      </Typography>
      {mode === "assign" && (
        <Autocomplete
          options={players}
          value={selectedPlayer}
          onChange={(_, option) => setPlayerId(option?.id ?? null)}
          getOptionLabel={playerLabel}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          filterOptions={(options, state) => searchPlayers(options, state.inputValue)}
          noOptionsText="Ningún jugador coincide"
          size="small"
          className={styles.fields}
          renderInput={(params) => <TextField {...params} label="Jugador" />}
        />
      )}
      <Stack direction="row" spacing={1.5} className={styles.fields}>
        <TextField
          label="Nº de taco"
          value={bookNumber}
          onChange={(e) => setBookNumber(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          size="small"
          fullWidth
        />
        <TextField
          label="Primera papeleta"
          value={firstTicket}
          onChange={(e) => changeFirstTicket(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          size="small"
          fullWidth
        />
        <TextField
          label="Última papeleta"
          value={lastTicket}
          onChange={(e) => changeLastTicket(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          size="small"
          fullWidth
        />
      </Stack>
      <Typography className={styles.highlight}>
        {numbersValid
          ? `Papeletas ${parsedFirst}–${parsedLast} · ${parsedLast - parsedFirst + 1} papeletas`
          : "Revisa el número de taco y las papeletas: la última no puede ser menor que la primera"}
      </Typography>
      <Stack direction="row" spacing={1.5} className={styles.actions}>
        <Button variant="outlined" onClick={onClose} fullWidth>
          Cancelar
        </Button>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!isValid || processing}
          onClick={() =>
            onSubmit({ teamPlayerId: playerId, bookNumber: parsedBook, firstTicketNumber: parsedFirst, lastTicketNumber: parsedLast })
          }
        >
          {submitLabel}
        </Button>
      </Stack>
    </Drawer>
  );
}
