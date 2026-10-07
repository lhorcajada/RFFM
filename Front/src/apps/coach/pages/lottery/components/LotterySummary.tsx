import { Paper, Typography } from "@mui/material";
import type { LotteryTotals } from "../../../services/lotteryService";
import { formatEuros } from "../lotteryHelpers";
import styles from "./LotterySummary.module.css";

type Props = {
  totals: LotteryTotals;
};

type Item = { label: string; value: string; hint?: string };

export default function LotterySummary({ totals }: Props) {
  const items: Item[] = [
    { label: "Tacos devueltos", value: `${totals.booksReturned}/${totals.booksDelivered}`, hint: `${totals.booksPending} por devolver` },
    { label: "Papeletas vendidas", value: String(totals.ticketsSold), hint: `${totals.ticketsUnsold} sobrantes` },
    { label: "Recogido", value: formatEuros(totals.amountCollected), hint: `${formatEuros(totals.amountPending)} pendiente` },
    { label: "Papeletas en la calle", value: String(totals.ticketsPending), hint: `de ${totals.ticketsDelivered} entregadas` },
  ];

  return (
    <div className={styles.row} data-testid="lottery-summary">
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
  );
}
