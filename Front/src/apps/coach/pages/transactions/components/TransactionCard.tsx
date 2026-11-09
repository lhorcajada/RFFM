import { Chip, Paper, Stack, Typography } from "@mui/material";
import { formatMoney } from "../../quiniela/quinielaHelpers";
import type {
  TeamTransaction,
  TransactionStatus,
  TransactionType,
} from "../../../services/transactionService";
import styles from "./TransactionCard.module.css";

export type TransactionCardProps = {
  transaction: TeamTransaction;
};

const TYPE_LABELS: Record<TransactionType, string> = {
  Sanction: "Sanción",
  Lottery: "Lotería",
  Quiniela: "Quiniela",
  WalletTopUp: "Recarga",
  WalletCharge: "Cargo",
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  Pending: "Pendiente de pago",
  Paid: "Pagado",
};

const MADRID_DATE = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string | null | undefined): string {
  return value ? MADRID_DATE.format(new Date(value)) : "Sin fecha";
}

export default function TransactionCard({ transaction }: TransactionCardProps) {
  const isPaid = transaction.status === "Paid";
  const outstandingAmount = isPaid ? null : (transaction.pendingAmount ?? null);

  return (
    <Paper component="article" variant="outlined" className={styles.card}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <div>
          <Typography variant="caption" className={styles.typeLabel}>
            {TYPE_LABELS[transaction.type]}
          </Typography>
          {transaction.personName && (
            <Typography variant="subtitle2" className={styles.personName}>
              {transaction.personName}
            </Typography>
          )}
        </div>
        <Chip
          label={STATUS_LABELS[transaction.status]}
          color={isPaid ? "success" : "error"}
          variant={isPaid ? "outlined" : "filled"}
          size="small"
        />
      </Stack>

      <Typography variant="body2" className={styles.description}>
        {transaction.description}
      </Typography>

      <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap className={styles.amounts}>
        <span>
          <span className={styles.fieldLabel}>Importe</span> {formatMoney(transaction.amount)}
        </span>
        {outstandingAmount != null && (
          <span className={styles.pendingAmount}>Pendiente {formatMoney(outstandingAmount)}</span>
        )}
      </Stack>

      <time className={styles.date} dateTime={transaction.date ?? undefined}>
        {formatDate(transaction.date)}
      </time>
    </Paper>
  );
}
