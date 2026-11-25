import { Button, Chip, IconButton, Paper, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { LotteryBook } from "../../../services/lotteryService";
import { BOOK_STATUS_LABELS } from "../lotteryHelpers";
import styles from "./LotteryUnassignedBooks.module.css";

type Props = {
  books: LotteryBook[];
  onAssign: (book: LotteryBook) => void;
  onDelete: (book: LotteryBook) => void;
};

export default function LotteryUnassignedBooks({ books, onAssign, onDelete }: Props) {
  if (books.length === 0) return null;

  return (
    <Paper variant="outlined" className={styles.card} data-testid="lottery-unassigned-books">
      <Typography className={styles.title}>Tacos sin asignar · {books.length}</Typography>
      <div className={styles.list}>
        {books.map((book) => (
          <div key={book.id} className={styles.book}>
            <div className={styles.info}>
              <Typography className={styles.bookNumber}>Taco {book.bookNumber}</Typography>
              <Typography variant="caption" className={styles.meta}>
                {book.firstTicketNumber}–{book.lastTicketNumber}
              </Typography>
            </div>
            <Chip size="small" label={BOOK_STATUS_LABELS.Unassigned} variant="outlined" />
            <Button variant="contained" size="small" onClick={() => onAssign(book)} aria-label={`Asignar taco ${book.bookNumber}`}>
              Asignar
            </Button>
            <IconButton size="small" onClick={() => onDelete(book)} aria-label={`Eliminar taco ${book.bookNumber}`}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
      </div>
    </Paper>
  );
}
