import { LinearProgress, Paper, Typography } from "@mui/material";
import type { LotteryTotals } from "../../../services/lotteryService";
import { formatEuros } from "../lotteryHelpers";
import styles from "./LotterySummary.module.css";

type Props = {
  totals: LotteryTotals;
};

type Item = { label: string; value: string; hint?: string };

export default function LotterySummary({ totals }: Props) {
  const progress = totals.booksDelivered > 0 ? Math.round((totals.booksReturned / totals.booksDelivered) * 100) : 0;
  const items: Item[] = [
    { label: "Papeletas vendidas", value: String(totals.ticketsSold), hint: `${totals.ticketsUnsold} sobrantes` },
    { label: "Papeletas en la calle", value: String(totals.ticketsPending), hint: `de ${totals.ticketsDelivered} entregadas` },
    { label: "Tacos devueltos", value: `${totals.booksReturned}/${totals.booksDelivered}`, hint: `${totals.booksPending} por devolver` },
  ];

  return (
    <div className={styles.wrapper} data-testid="lottery-summary">
      <Paper variant="outlined" className={styles.hero}>
        <Typography variant="caption" className={styles.heroLabel}>
          Recogido
        </Typography>
        <Typography className={styles.heroValue}>{formatEuros(totals.amountCollected)}</Typography>
        <LinearProgress variant="determinate" value={progress} aria-label="Tacos devueltos" className={styles.track} />
        <Typography variant="caption" className={styles.heroHint}>
          {formatEuros(totals.amountPending)} pendiente
        </Typography>
      </Paper>
      <div className={styles.row}>
        {items.map((item) => (
          <Paper key={item.label} variant="outlined" className={styles.card}>
            <Typography variant="caption" className={styles.label}>
              {item.label}
            </Typography>
            <Typography variant="h6" className={styles.value}>
              {item.value}
            </Typography>
            {item.hint && (
              <Typography variant="caption" className={styles.hint}>
                {item.hint}
              </Typography>
            )}
          </Paper>
        ))}
      </div>
    </div>
  );
}
