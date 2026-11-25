import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";

export const MAX_BOOKS_PER_BATCH = 200;

type Props = {
  open: boolean;
  ticketsPerBook: number;
  processing: boolean;
  onClose: () => void;
  onSubmit: (count: number) => void;
};

export default function CreateBooksDialog({ open, ticketsPerBook, processing, onClose, onSubmit }: Props) {
  const [count, setCount] = useState("10");

  useEffect(() => {
    if (open) setCount("10");
  }, [open]);

  const parsed = Number.parseInt(count, 10);
  const isValid = parsed >= 1 && parsed <= MAX_BOOKS_PER_BATCH;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Crear tacos</DialogTitle>
      <DialogContent>
        <TextField
          label="Cuántos tacos"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          size="small"
          fullWidth
          sx={{ mt: 1 }}
          error={!isValid}
          helperText={`Entre 1 y ${MAX_BOOKS_PER_BATCH}`}
        />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          Se crean seguidos, de {ticketsPerBook} papeletas cada uno, a continuación del último taco, y quedan sin asignar.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancelar
        </Button>
        <Button variant="contained" disabled={!isValid || processing} onClick={() => onSubmit(parsed)}>
          Crear tacos
        </Button>
      </DialogActions>
    </Dialog>
  );
}
