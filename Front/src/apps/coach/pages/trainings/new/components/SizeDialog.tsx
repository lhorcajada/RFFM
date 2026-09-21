import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import type { SizeDialogState } from "../hooks/useTacticalBoard";

interface SizeDialogProps {
  dialog: SizeDialogState | null;
  onClose: () => void;
}

export default function SizeDialog({ dialog, onClose }: SizeDialogProps) {
  return (
    <Dialog open={dialog !== null} onClose={onClose} maxWidth="xs" fullWidth>
      {dialog && <SizeDialogForm key={dialog.title} dialog={dialog} onClose={onClose} />}
    </Dialog>
  );
}

function SizeDialogForm({ dialog, onClose }: { dialog: SizeDialogState; onClose: () => void }) {
  const [values, setValues] = useState(dialog.fields.map((field) => field.value));

  const parsed = values.map((value) => Number(value.replace(",", ".")));
  const isValid = parsed.every((value) => Number.isFinite(value) && value > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    dialog.onSubmit(parsed);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogTitle>{dialog.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {dialog.fields.map((field, index) => (
            <TextField
              key={field.label}
              label={field.label}
              value={values[index]}
              onChange={(e) => setValues((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
              autoFocus={index === 0}
              size="small"
              fullWidth
              inputProps={{ inputMode: "decimal" }}
              error={!Number.isFinite(parsed[index]) || parsed[index] <= 0}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" size="small">Cancelar</Button>
        <Button type="submit" variant="contained" size="small" disabled={!isValid}>Aplicar</Button>
      </DialogActions>
    </form>
  );
}
