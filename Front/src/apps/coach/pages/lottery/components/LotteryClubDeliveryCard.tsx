import { IconButton, Paper, Typography } from "@mui/material";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import type { LotteryCampaign } from "../../../services/lotteryService";
import { formatEuros, formatShortDate, isWithin, todayIso } from "../lotteryHelpers";
import styles from "./LotteryClubDeliveryCard.module.css";

type Props = {
  campaign: LotteryCampaign;
  onEditWindow: () => void;
};

/** Resumen de la entrega al club calculado con los tacos; cada taco se entrega desde su tarjeta. */
export default function LotteryClubDeliveryCard({ campaign, onEditWindow }: Props) {
  const { clubDelivery } = campaign;
  const today = todayIso();
  const hasPending = clubDelivery.booksPending > 0;
  const inWindow = isWithin(today, campaign.clubDeliveryFrom, campaign.clubDeliveryTo);
  const isLate = today > campaign.clubDeliveryTo && hasPending;
  const cardClass = [styles.card, inWindow && hasPending ? styles.active : "", isLate ? styles.late : ""].join(" ");

  return (
    <Paper variant="outlined" className={cardClass}>
      <div className={styles.header}>
        <div className={styles.info}>
          <Typography className={styles.title}>Entrega al club</Typography>
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

      <div className={styles.body}>
        <Typography className={styles.amount}>
          Entregados {clubDelivery.booksDelivered} · {formatEuros(clubDelivery.amountDelivered)}
          {clubDelivery.lastDeliveredOn ? ` · último el ${formatShortDate(clubDelivery.lastDeliveredOn)}` : ""}
        </Typography>
      </div>
      <Typography variant="caption" className={styles.muted}>
        Por entregar {clubDelivery.booksPending} · {formatEuros(clubDelivery.amountPending)}
      </Typography>
    </Paper>
  );
}
