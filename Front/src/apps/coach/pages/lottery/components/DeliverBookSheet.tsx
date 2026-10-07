import { useEffect, useState } from "react";
import { Button, Drawer, Stack, TextField, Typography } from "@mui/material";
import styles from "./LotterySheet.module.css";

export type DeliverBookValues = {
  bookNumber: number;
  firstTicketNumber: number;
  deliveredOn: string;
};

type Props = {
  open: boolean;
  title: string;
  playerName: string;
  submitLabel: string;
  initial: DeliverBookValues;
  ticketsPerBook: number;
  processing: boolean;
  onClose: () => void;
  onSubmit: (values: DeliverBookValues) => void;
};

export default function DeliverBookSheet({
  open,
  title,
  playerName,
  submitLabel,
  initial,
  ticketsPerBook,
  processing,
  onClose,
  onSubmit,
}: Props) {
  const [bookNumber, setBookNumber] = useState(String(initial.bookNumber));
  const [firstTicket, setFirstTicket] = useState(String(initial.firstTicketNumber));
  const [deliveredOn, setDeliveredOn] = useState(initial.deliveredOn);

  useEffect(() => {
    if (!open) return;
    setBookNumber(String(initial.bookNumber));
    setFirstTicket(String(initial.firstTicketNumber));
    setDeliveredOn(initial.deliveredOn);
  }, [open, initial.bookNumber, initial.firstTicketNumber, initial.deliveredOn]);

  const parsedBook = Number.parseInt(bookNumber, 10);
  const parsedFirst = Number.parseInt(firstTicket, 10);
  const isValid = parsedBook > 0 && parsedFirst >= 0 && Boolean(deliveredOn);
  const lastTicket = isValid ? parsedFirst + ticketsPerBook - 1 : null;

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
      <Typography variant="body2" className={styles.subtitle}>
        {playerName}
      </Typography>
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
          onChange={(e) => setFirstTicket(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          size="small"
          fullWidth
        />
      </Stack>
      <Typography className={styles.highlight}>
        {lastTicket !== null ? `Papeletas ${parsedFirst}–${lastTicket}` : "Revisa el número de taco y la primera papeleta"}
      </Typography>
      <TextField
        label="Fecha de entrega"
        type="date"
        value={deliveredOn}
        onChange={(e) => setDeliveredOn(e.target.value)}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
        className={styles.fields}
      />
      <Stack direction="row" spacing={1.5} className={styles.actions}>
        <Button variant="outlined" onClick={onClose} fullWidth>
          Cancelar
        </Button>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!isValid || processing}
          onClick={() => onSubmit({ bookNumber: parsedBook, firstTicketNumber: parsedFirst, deliveredOn })}
        >
          {submitLabel}
        </Button>
      </Stack>
    </Drawer>
  );
}
