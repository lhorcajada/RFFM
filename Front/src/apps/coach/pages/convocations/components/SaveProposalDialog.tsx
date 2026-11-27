import { useState } from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

type Props = {
  defaultName: string;
  /** Resolves to false when it could not be saved: the dialog stays open to retry. */
  onSave: (name: string) => Promise<boolean>;
  onClose: () => void;
};

const MAX_NAME_LENGTH = 60;

export default function SaveProposalDialog({ defaultName, onSave, onClose }: Props) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || saving) return;
    setSaving(true);
    const saved = await onSave(trimmed);
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Guardar propuesta</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            inputProps={{ maxLength: MAX_NAME_LENGTH }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" size="small" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={!trimmed || saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
