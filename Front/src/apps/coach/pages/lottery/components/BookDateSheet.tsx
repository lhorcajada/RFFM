import { useEffect, useState } from "react";
import { Button, Drawer, Stack, TextField, Typography } from "@mui/material";
import { todayIso } from "../lotteryHelpers";
import styles from "./LotterySheet.module.css";

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  dateLabel: string;
  submitLabel: string;
  processing: boolean;
  onClose: () => void;
  onSubmit: (date: string) => void;
};

/** Paso que solo pide una fecha (entrega al jugador o entrega al club); por defecto, hoy. */
export default function BookDateSheet({ open, title, subtitle, dateLabel, submitLabel, processing, onClose, onSubmit }: Props) {
  const [date, setDate] = useState(todayIso());

  useEffect(() => {
    if (open) setDate(todayIso());
  }, [open]);

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
        {subtitle}
      </Typography>
      <TextField
        label={dateLabel}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
        className={styles.fields}
      />
      <Stack direction="row" spacing={1.5} className={styles.actions}>
        <Button variant="outlined" onClick={onClose} fullWidth>
          Cancelar
        </Button>
        <Button variant="contained" size="large" fullWidth disabled={!date || processing} onClick={() => onSubmit(date)}>
          {submitLabel}
        </Button>
      </Stack>
    </Drawer>
  );
}
