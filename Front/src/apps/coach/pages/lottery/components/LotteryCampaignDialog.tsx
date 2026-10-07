import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import type { LotteryCampaignRequest } from "../../../services/lotteryService";

type Props = {
  open: boolean;
  title: string;
  initial: LotteryCampaignRequest;
  /** Con tacos entregados no se pueden cambiar el precio ni las papeletas por taco. */
  bookSettingsLocked: boolean;
  processing: boolean;
  onClose: () => void;
  onSubmit: (values: LotteryCampaignRequest) => void;
};

export default function LotteryCampaignDialog({ open, title, initial, bookSettingsLocked, processing, onClose, onSubmit }: Props) {
  const [values, setValues] = useState<LotteryCampaignRequest>(initial);

  useEffect(() => {
    if (open) setValues(initial);
  }, [open, initial]);

  const set = <K extends keyof LotteryCampaignRequest>(key: K, value: LotteryCampaignRequest[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const invalidWindow = values.clubDeliveryFrom > values.clubDeliveryTo || values.clubDeliveryTo > values.drawDate;
  const isValid =
    values.name.trim().length > 0 &&
    values.ticketPrice > 0 &&
    values.ticketsPerBook >= 1 &&
    values.ticketsPerBook <= 100 &&
    Boolean(values.drawDate && values.clubDeliveryFrom && values.clubDeliveryTo) &&
    !invalidWindow;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Nombre" value={values.name} onChange={(e) => set("name", e.target.value)} size="small" fullWidth />
          <TextField
            label="Fecha del sorteo"
            type="date"
            value={values.drawDate}
            onChange={(e) => set("drawDate", e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Precio papeleta (€)"
              type="number"
              value={values.ticketPrice}
              onChange={(e) => set("ticketPrice", Number(e.target.value))}
              size="small"
              disabled={bookSettingsLocked}
              inputProps={{ min: 0, step: 0.5, inputMode: "decimal" }}
            />
            <TextField
              label="Papeletas por taco"
              type="number"
              value={values.ticketsPerBook}
              onChange={(e) => set("ticketsPerBook", Number(e.target.value))}
              size="small"
              disabled={bookSettingsLocked}
              inputProps={{ min: 1, max: 100, inputMode: "numeric" }}
            />
          </Stack>
          {bookSettingsLocked && (
            <Typography variant="caption" color="text.secondary">
              Ya hay tacos entregados: el precio y las papeletas por taco no se pueden cambiar.
            </Typography>
          )}
          <Typography variant="subtitle2">Entrega al club</Typography>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Desde"
              type="date"
              value={values.clubDeliveryFrom}
              onChange={(e) => set("clubDeliveryFrom", e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Hasta"
              type="date"
              value={values.clubDeliveryTo}
              onChange={(e) => set("clubDeliveryTo", e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          {invalidWindow && (
            <Typography variant="caption" color="error">
              La entrega al club debe empezar antes de terminar y no puede acabar después del sorteo.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancelar
        </Button>
        <Button variant="contained" disabled={!isValid || processing} onClick={() => onSubmit({ ...values, name: values.name.trim() })}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
