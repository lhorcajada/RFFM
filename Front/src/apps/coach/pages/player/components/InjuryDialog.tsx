import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import type { InjuryRecord } from "../../../services/teamplayerService";

type Props = {
  open: boolean;
  current?: InjuryRecord | null;
  onSave: (data: {
    startDate: string;
    injuryType: string;
    description?: string | null;
    estimatedRecovery?: string | null;
    endDate?: string | null;
  }) => void;
  onClose: () => void;
  saving?: boolean;
};

export default function InjuryDialog({
  open,
  current,
  onSave,
  onClose,
  saving,
}: Props) {
  const [startDate, setStartDate] = useState(
    current?.startDate
      ? current.startDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [injuryType, setInjuryType] = useState(current?.injuryType ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [estimatedRecovery, setEstimatedRecovery] = useState(
    current?.estimatedRecovery ?? ""
  );
  const [endDate, setEndDate] = useState(
    current?.endDate ? current.endDate.slice(0, 10) : ""
  );

  useEffect(() => {
    if (open) {
      setStartDate(
        current?.startDate
          ? current.startDate.slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      setInjuryType(current?.injuryType ?? "");
      setDescription(current?.description ?? "");
      setEstimatedRecovery(current?.estimatedRecovery ?? "");
      setEndDate(current?.endDate ? current.endDate.slice(0, 10) : "");
    }
  }, [open, current]);

  const canSave = injuryType.trim().length > 0 && startDate.length > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{current ? "Editar lesión" : "Registrar lesión"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Fecha de inicio"
            type="date"
            size="small"
            fullWidth
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            label="Tipo de lesión"
            size="small"
            fullWidth
            value={injuryType}
            onChange={(e) => setInjuryType(e.target.value)}
            placeholder="Ej: Rotura fibrilar, esguince de tobillo..."
            required
          />
          <TextField
            label="¿Cómo ocurrió?"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción de cómo sucedió la lesión"
          />
          <TextField
            label="Tiempo estimado de recuperación"
            size="small"
            fullWidth
            value={estimatedRecovery}
            onChange={(e) => setEstimatedRecovery(e.target.value)}
            placeholder="Ej: 3-4 semanas"
          />
          {current && (
            <TextField
              label="Fecha de alta"
              type="date"
              size="small"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Rellena para marcar la lesión como resuelta"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() =>
            onSave({
              startDate,
              injuryType,
              description: description || null,
              estimatedRecovery: estimatedRecovery || null,
              endDate: endDate || null,
            })
          }
          disabled={!canSave || saving}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
