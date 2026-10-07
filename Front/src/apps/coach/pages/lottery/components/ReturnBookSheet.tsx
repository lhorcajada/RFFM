import { useEffect, useState } from "react";
import { Button, Drawer, IconButton, Stack, TextField, Typography } from "@mui/material";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import type { LotteryBook } from "../../../services/lotteryService";
import { formatEuros, todayIso } from "../lotteryHelpers";
import styles from "./LotterySheet.module.css";

type Props = {
  open: boolean;
  book: LotteryBook | null;
  playerName: string;
  ticketPrice: number;
  ticketsPerBook: number;
  processing: boolean;
  onClose: () => void;
  onSubmit: (amount: number, returnedOn: string) => void;
};

export default function ReturnBookSheet({ open, book, playerName, ticketPrice, ticketsPerBook, processing, onClose, onSubmit }: Props) {
  const maxAmount = ticketPrice * ticketsPerBook;
  const [amount, setAmount] = useState(maxAmount);
  const [returnedOn, setReturnedOn] = useState(todayIso());

  useEffect(() => {
    if (!open) return;
    setAmount(maxAmount);
    setReturnedOn(todayIso());
  }, [open, maxAmount]);

  const sold = Math.round(amount / ticketPrice);
  const unsold = ticketsPerBook - sold;
  const title = book ? `Devolución · Taco ${book.bookNumber}` : "Devolución";

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
        {book ? ` · papeletas ${book.firstTicketNumber}–${book.lastTicketNumber}` : ""}
      </Typography>

      <Button
        variant="contained"
        color="success"
        size="large"
        fullWidth
        className={styles.quickButton}
        disabled={processing}
        onClick={() => onSubmit(maxAmount, returnedOn)}
      >
        Todo vendido · {formatEuros(maxAmount)}
      </Button>

      <div className={styles.stepper}>
        <IconButton
          aria-label={`Restar ${formatEuros(ticketPrice)}`}
          onClick={() => setAmount((value) => Math.max(0, value - ticketPrice))}
          disabled={amount <= 0}
          className={styles.stepButton}
        >
          <RemoveIcon />
        </IconButton>
        <div className={styles.amount}>
          <Typography variant="h4" className={styles.amountValue}>
            {formatEuros(amount)}
          </Typography>
          <Typography variant="body2" className={styles.subtitle}>
            {sold} vendidas · {unsold} sobrantes
          </Typography>
        </div>
        <IconButton
          aria-label={`Sumar ${formatEuros(ticketPrice)}`}
          onClick={() => setAmount((value) => Math.min(maxAmount, value + ticketPrice))}
          disabled={amount >= maxAmount}
          className={styles.stepButton}
        >
          <AddIcon />
        </IconButton>
      </div>

      <TextField
        label="Fecha de devolución"
        type="date"
        value={returnedOn}
        onChange={(e) => setReturnedOn(e.target.value)}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
        className={styles.fields}
      />

      <Stack direction="row" spacing={1.5} className={styles.actions}>
        <Button variant="outlined" fullWidth disabled={processing} onClick={() => onSubmit(0, returnedOn)}>
          Nada vendido · 0 €
        </Button>
        <Button variant="contained" fullWidth disabled={processing || !returnedOn} onClick={() => onSubmit(amount, returnedOn)}>
          Registrar devolución
        </Button>
      </Stack>
    </Drawer>
  );
}
