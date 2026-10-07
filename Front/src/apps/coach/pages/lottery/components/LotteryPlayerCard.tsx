import { useState } from "react";
import { Avatar, Button, IconButton, Menu, MenuItem, Paper, Typography } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { LotteryBook } from "../../../services/lotteryService";
import { formatEuros, formatShortDate } from "../lotteryHelpers";
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
  onDeliver: (player: LotteryCardPlayer) => void;
  onReturn: (book: LotteryBook) => void;
  onEdit: (book: LotteryBook) => void;
  onUndoReturn: (book: LotteryBook) => void;
  onDelete: (book: LotteryBook) => void;
};

export default function LotteryPlayerCard({ player, books, canEdit, onDeliver, onReturn, onEdit, onUndoReturn, onDelete }: Props) {
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
          <Button variant="contained" size="small" onClick={() => onDeliver(player)} aria-label={`Entregar taco a ${player.alias || player.name}`}>
            Entregar
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

      {books.map((book) => (
        <div key={book.id} className={book.amountReturned === null ? styles.book : `${styles.book} ${styles.returned}`}>
          <div className={styles.bookInfo}>
            <Typography className={styles.bookNumber}>Taco {book.bookNumber}</Typography>
            <Typography variant="caption" className={styles.bookMeta}>
              {book.firstTicketNumber}–{book.lastTicketNumber} · entregado {formatShortDate(book.deliveredOn)}
            </Typography>
            {book.amountReturned !== null && (
              <Typography variant="caption" className={styles.bookResult}>
                {formatEuros(book.amountReturned)} · {book.ticketsSold} vendidas · {book.ticketsUnsold} sobrantes ·{" "}
                {formatShortDate(book.returnedOn)}
              </Typography>
            )}
          </div>
          {book.amountReturned === null && canEdit && (
            <Button variant="contained" color="secondary" size="small" onClick={() => onReturn(book)} aria-label={`Devolver taco ${book.bookNumber}`}>
              Devolver
            </Button>
          )}
          {book.amountReturned !== null && <CheckCircleIcon color="success" aria-label="Devuelto" />}
        </div>
      ))}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={run(() => onDeliver(player))}>Entregar otro taco</MenuItem>
        {books.map((book) => [
          <MenuItem key={`edit-${book.id}`} onClick={run(() => onEdit(book))}>
            Editar taco {book.bookNumber}
          </MenuItem>,
          book.amountReturned !== null ? (
            <MenuItem key={`undo-${book.id}`} onClick={run(() => onUndoReturn(book))}>
              Deshacer devolución del taco {book.bookNumber}
            </MenuItem>
          ) : (
            <MenuItem key={`delete-${book.id}`} onClick={run(() => onDelete(book))}>
              Eliminar taco {book.bookNumber}
            </MenuItem>
          ),
        ])}
      </Menu>
    </Paper>
  );
}
