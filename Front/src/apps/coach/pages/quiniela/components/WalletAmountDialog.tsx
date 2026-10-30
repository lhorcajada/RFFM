import { useEffect, useState } from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { parseWalletAmount } from "../quinielaHelpers";

export type WalletAmountMode = "topUp" | "adjust";

export type WalletAmountSubmit = {
  amount: number;
  text: string;
};

type Props = {
  open: boolean;
  mode: WalletAmountMode;
  userName: string;
  processing?: boolean;
  onCancel: () => void;
  onSubmit: (value: WalletAmountSubmit) => void;
};

const COPY: Record<WalletAmountMode, { title: string; textLabel: string; submit: string }> = {
  topUp: { title: "Recargar monedero", textLabel: "Descripción (opcional)", submit: "Recargar" },
  adjust: { title: "Restar saldo", textLabel: "Motivo", submit: "Continuar" },
};

export default function WalletAmountDialog({ open, mode, userName, processing = false, onCancel, onSubmit }: Props) {
  const [amountText, setAmountText] = useState("");
  const [text, setText] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const copy = COPY[mode];

  useEffect(() => {
    if (!open) return;
    setAmountText("");
    setText("");
    setAmountError(null);
    setTextError(null);
  }, [open, mode]);

  const handleSubmit = () => {
    const parsed = parseWalletAmount(amountText);
    const trimmed = text.trim();
    const reasonMissing = mode === "adjust" && !trimmed;
    setAmountError("error" in parsed ? parsed.error : null);
    setTextError(reasonMissing ? "Indica el motivo del ajuste." : null);
    if ("error" in parsed || reasonMissing) return;
    onSubmit({ amount: parsed.value, text: trimmed });
  };

  return (
    <Dialog open={open} onClose={processing ? undefined : onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{`${copy.title} · ${userName}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Importe (€)"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            error={amountError !== null}
            helperText={amountError ?? "Entre 0,01 € y 10,00 €"}
            inputProps={{ inputMode: "decimal" }}
            autoFocus
            fullWidth
          />
          <TextField
            label={copy.textLabel}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={textError !== null}
            helperText={textError ?? undefined}
            inputProps={{ maxLength: 200 }}
            fullWidth
          />
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
          {copy.submit}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
