import { LinearProgress, Paper, Stack, Typography } from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import SavingsIcon from "@mui/icons-material/Savings";
import styles from "./SanctionsSummaryCards.module.css";

export type SanctionsSummaryCardsProps = {
  totalFine: number;
  totalPending: number;
  /** Team fund balance, `null` while it hasn't loaded yet (rendered as 0 €). */
  fundBalance: number | null;
};

function formatAmount(value: number | null): string {
  return `${value ?? 0} €`;
}

export default function SanctionsSummaryCards({
  totalFine,
  totalPending,
  fundBalance,
}: SanctionsSummaryCardsProps) {
  const totalPaid = Math.max(totalFine - totalPending, 0);
  const paidPercent = totalFine > 0 ? Math.round((totalPaid / totalFine) * 100) : 0;

  return (
    <Stack
      direction="row"
      spacing={1.5}
      useFlexGap
      flexWrap="wrap"
      className={styles.summaryRow}
      data-testid="sanctions-summary-cards"
    >
      <Paper variant="outlined" className={`${styles.summaryCard} ${styles.pendingCard}`}>
        <PendingActionsIcon color="warning" />
        <div className={styles.pendingBody}>
          <Typography variant="caption" className={styles.summaryLabel}>
            Total pendiente
          </Typography>
          <Typography variant="h4" component="p" className={styles.pendingValue}>
            {formatAmount(totalPending)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={paidPercent}
            color="success"
            aria-label="Porcentaje cobrado"
            className={styles.progress}
          />
          <Typography variant="body2" className={styles.summaryLabel}>
            {`${formatAmount(totalPaid)} cobrados de ${formatAmount(totalFine)}`}
          </Typography>
        </div>
      </Paper>

      <Paper variant="outlined" className={styles.summaryCard}>
        <ReceiptLongIcon color="warning" />
        <div>
          <Typography variant="caption" className={styles.summaryLabel}>
            Total multado
          </Typography>
          <Typography variant="subtitle1" className={styles.summaryValue}>
            {formatAmount(totalFine)}
          </Typography>
        </div>
      </Paper>

      <Paper variant="outlined" className={styles.summaryCard}>
        <SavingsIcon color="success" />
        <div>
          <Typography variant="caption" className={styles.summaryLabel}>
            Bolsa del equipo
          </Typography>
          <Typography variant="subtitle1" className={styles.summaryValue}>
            {formatAmount(fundBalance)}
          </Typography>
        </div>
      </Paper>
    </Stack>
  );
}
