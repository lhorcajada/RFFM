import { useEffect, useState } from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { formatMoney, parseDonationAmount } from "../quinielaHelpers";

type Props = {
  open: boolean;
  balance: number;
  processing?: boolean;
  onCancel: () => void;
  onSubmit: (amount: number) => void;
};

export default function WalletDonateDialog({ open, balance, processing = false, onCancel, onSubmit }: Props) {
  const [amountText, setAmountText] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountText("");
    setAmountError(null);
  }, [open]);

  const handleSubmit = () => {
    const parsed = parseDonationAmount(amountText, balance);
    setAmountError("error" in parsed ? parsed.error : null);
    if ("error" in parsed) return;
    onSubmit(parsed.value);
  };

  return (
    <Dialog open={open} onClose={processing ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Donar al equipo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Importe (€)"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            error={amountError !== null}
            helperText={amountError ?? `Hasta ${formatMoney(balance)}, tu saldo disponible`}
            inputProps={{ inputMode: "decimal" }}
            autoFocus
            fullWidth
          />
          <span>El dinero pasa al fondo del equipo y no se puede deshacer.</span>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" disabled={processing}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={processing}
          startIcon={processing ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Donar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
