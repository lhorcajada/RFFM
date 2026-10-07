import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import type { LotteryCampaign } from "../../../services/lotteryService";
import { formatEuros, formatShortDate, isWithin, todayIso } from "../lotteryHelpers";
import styles from "./LotteryClubDeliveryCard.module.css";

type Props = {
  campaign: LotteryCampaign;
  processing: boolean;
  onEditWindow: () => void;
  onRecord: (amount: number, deliveredOn: string) => void;
  onUndo: () => void;
};

export default function LotteryClubDeliveryCard({ campaign, processing, onEditWindow, onRecord, onUndo }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [deliveredOn, setDeliveredOn] = useState(todayIso());

  const collected = campaign.totals.amountCollected;
  const delivered = campaign.clubDeliveredAmount;
  const today = todayIso();
  const inWindow = isWithin(today, campaign.clubDeliveryFrom, campaign.clubDeliveryTo);
  const isLate = today > campaign.clubDeliveryTo && delivered === null;
  const difference = delivered !== null ? delivered - collected : 0;
  const parsedAmount = Number(amount);

  const openDialog = () => {
    setAmount(String(collected));
    setDeliveredOn(todayIso());
    setOpen(true);
  };

  const cardClass = [styles.card, inWindow && delivered === null ? styles.active : "", isLate ? styles.late : ""].join(" ");

  return (
    <Paper variant="outlined" className={cardClass}>
      <div className={styles.header}>
        <div className={styles.info}>
          <Typography className={styles.title}>Liquidación con el club</Typography>
          <Typography variant="caption" className={styles.muted}>
            Entrega del {formatShortDate(campaign.clubDeliveryFrom)} al {formatShortDate(campaign.clubDeliveryTo)} · sorteo el{" "}
            {formatShortDate(campaign.drawDate)}
          </Typography>
        </div>
        {campaign.canEdit && (
          <IconButton size="small" aria-label="Editar fechas de entrega al club" onClick={onEditWindow}>
            <EditCalendarIcon fontSize="small" />
          </IconButton>
        )}
      </div>

      {delivered === null ? (
        <Stack direction="row" alignItems="center" spacing={1} className={styles.body}>
          <Typography className={styles.amount}>Recogido {formatEuros(collected)}</Typography>
          {campaign.canEdit && (
            <Button variant="contained" onClick={openDialog} disabled={processing}>
              Entregar al club
            </Button>
          )}
        </Stack>
      ) : (
        <Stack direction="row" alignItems="center" spacing={1} className={styles.body}>
          <div className={styles.info}>
            <Typography className={styles.amount}>
              Entregado {formatEuros(delivered)} el {formatShortDate(campaign.clubDeliveredOn)}
            </Typography>
            {difference !== 0 && (
              <Typography variant="caption" color="warning.main">
                {difference > 0 ? "Sobran" : "Faltan"} {formatEuros(Math.abs(difference))} respecto a lo recogido ({formatEuros(collected)})
              </Typography>
            )}
          </div>
          {campaign.canEdit && (
            <Button size="small" onClick={onUndo} disabled={processing}>
              Deshacer
            </Button>
          )}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Entrega al club</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Importe (€)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              size="small"
              inputProps={{ min: 0, inputMode: "decimal" }}
              helperText={`Recogido de los jugadores: ${formatEuros(collected)}`}
            />
            <TextField
              label="Fecha"
              type="date"
              value={deliveredOn}
              onChange={(e) => setDeliveredOn(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={amount === "" || Number.isNaN(parsedAmount) || parsedAmount < 0 || !deliveredOn || processing}
            onClick={() => {
              setOpen(false);
              onRecord(parsedAmount, deliveredOn);
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
