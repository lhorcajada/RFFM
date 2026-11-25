import { useState } from "react";
import { Avatar, Button, Chip, IconButton, Menu, MenuItem, Paper, Typography } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { LotteryBook, LotteryBookStatus } from "../../../services/lotteryService";
import { BOOK_STATUS_LABELS, formatEuros, formatShortDate } from "../lotteryHelpers";
import styles from "./LotteryPlayerCard.module.css";

export type LotteryCardPlayer = {
  id: string;
  name: string;
  lastName?: string | null;
  alias: string;
  dorsal?: number | null;
};

type Props = {
  player: LotteryCardPlayer;
  books: LotteryBook[];
  canEdit: boolean;
  onAssign: (player: LotteryCardPlayer) => void;
  onAdvance: (book: LotteryBook) => void;
  onEdit: (book: LotteryBook) => void;
  onUndo: (book: LotteryBook) => void;
};

const STATUS_COLORS: Record<LotteryBookStatus, "default" | "info" | "warning" | "secondary" | "success"> = {
  Unassigned: "default",
  Assigned: "info",
  DeliveredToPlayer: "warning",
  ReturnedToCoach: "secondary",
  DeliveredToClub: "success",
};

const UNDO_LABELS: Partial<Record<LotteryBookStatus, (bookNumber: number) => string>> = {
  Assigned: (n) => `Quitar el jugador del taco ${n}`,
  DeliveredToPlayer: (n) => `Deshacer la entrega del taco ${n}`,
  ReturnedToCoach: (n) => `Deshacer la devolución del taco ${n}`,
  DeliveredToClub: (n) => `Deshacer la entrega al club del taco ${n}`,
};

type StepAction = { text: string; ariaLabel: (bookNumber: number) => string; color: "primary" | "secondary" | "success" };

const STEP_ACTIONS: Partial<Record<LotteryBookStatus, StepAction>> = {
  Assigned: { text: "Entregar", ariaLabel: (n) => `Entregar taco ${n} al jugador`, color: "primary" },
  DeliveredToPlayer: { text: "Devolver", ariaLabel: (n) => `Devolver taco ${n}`, color: "secondary" },
  ReturnedToCoach: { text: "Al club", ariaLabel: (n) => `Entregar taco ${n} al club`, color: "success" },
};

export default function LotteryPlayerCard({ player, books, canEdit, onAssign, onAdvance, onEdit, onUndo }: Props) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const fullName = [player.name, player.lastName].filter(Boolean).join(" ");
  const closeMenu = () => setMenuAnchor(null);
  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  return (
    <Paper variant="outlined" className={styles.card} data-testid="lottery-player-card">
      <div className={styles.header}>
        <Avatar className={styles.dorsal}>{player.dorsal ?? "–"}</Avatar>
        <div className={styles.identity}>
          <Typography className={styles.alias}>{player.alias || player.name}</Typography>
          <Typography variant="caption" className={styles.fullName}>
            {fullName}
          </Typography>
        </div>
        {books.length === 0 && canEdit && (
          <Button variant="contained" size="small" onClick={() => onAssign(player)} aria-label={`Asignar taco a ${player.alias || player.name}`}>
            Asignar
          </Button>
        )}
        {books.length === 0 && !canEdit && (
          <Typography variant="caption" className={styles.fullName}>
            Sin taco
          </Typography>
        )}
        {canEdit && books.length > 0 && (
          <IconButton size="small" aria-label={`Más acciones de ${player.alias || player.name}`} onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </div>

      {books.map((book) => {
        const step = STEP_ACTIONS[book.status];
        const reachedReturn = book.status === "ReturnedToCoach" || book.status === "DeliveredToClub";
        return (
          <div key={book.id} className={reachedReturn ? `${styles.book} ${styles.returned}` : styles.book}>
            <div className={styles.bookInfo}>
              <div className={styles.bookTitle}>
                <Typography className={styles.bookNumber}>Taco {book.bookNumber}</Typography>
                <Chip size="small" label={BOOK_STATUS_LABELS[book.status]} color={STATUS_COLORS[book.status]} variant="outlined" />
              </div>
              <Typography variant="caption" className={styles.bookMeta}>
                {book.firstTicketNumber}–{book.lastTicketNumber}
                {book.deliveredOn ? ` · entregado ${formatShortDate(book.deliveredOn)}` : ""}
              </Typography>
              {reachedReturn && book.amountReturned !== null && (
                <Typography variant="caption" className={styles.bookResult}>
                  {formatEuros(book.amountReturned)} · {book.ticketsSold} vendidas · {book.ticketsUnsold} sobrantes ·{" "}
                  {formatShortDate(book.returnedOn)}
                </Typography>
              )}
              {book.clubDeliveredOn && (
                <Typography variant="caption" className={styles.bookResult}>
                  Entregado al club el {formatShortDate(book.clubDeliveredOn)}
                </Typography>
              )}
            </div>
            {step && canEdit && (
              <Button variant="contained" color={step.color} size="small" onClick={() => onAdvance(book)} aria-label={step.ariaLabel(book.bookNumber)}>
                {step.text}
              </Button>
            )}
            {book.status === "DeliveredToClub" && <CheckCircleIcon color="success" aria-label="Entregado al club" />}
          </div>
        );
      })}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={run(() => onAssign(player))}>Asignar otro taco</MenuItem>
        {books.map((book) => [
          book.status === "Assigned" && (
            <MenuItem key={`edit-${book.id}`} onClick={run(() => onEdit(book))}>
              Editar taco {book.bookNumber}
            </MenuItem>
          ),
          <MenuItem key={`undo-${book.id}`} onClick={run(() => onUndo(book))}>
            {UNDO_LABELS[book.status]?.(book.bookNumber)}
          </MenuItem>,
        ])}
      </Menu>
    </Paper>
  );
}
