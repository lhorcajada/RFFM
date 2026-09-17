import { Chip } from "@mui/material";
import type { PlayerDocumentStatus } from "../../../../apps/coach/services/playerDocumentService";
import styles from "./PlayerDocumentStatusChip.module.css";

type Props = { status: PlayerDocumentStatus };

const LABELS: Record<PlayerDocumentStatus, string> = {
  Pending: "Pendiente",
  Delivered: "Entregado",
  Approved: "Aprobado",
  Rejected: "Rechazado",
};

const COLORS: Record<PlayerDocumentStatus, "warning" | "info" | "success" | "error"> = {
  Pending: "warning",
  Delivered: "info",
  Approved: "success",
  Rejected: "error",
};

export default function PlayerDocumentStatusChip({ status }: Props) {
  return (
    <Chip
      label={LABELS[status]}
      color={COLORS[status]}
      size="small"
      className={styles.chip}
    />
  );
}
