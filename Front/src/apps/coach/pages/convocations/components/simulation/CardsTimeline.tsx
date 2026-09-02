import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { CardEvent } from "./liveMatch.types";
import styles from "./CardsTimeline.module.css";

interface CardsTimelineProps {
  cards: CardEvent[];
  onRemoveCard: (cardId: string) => void;
  /** When true, hides the delete button (used in read-only saved-data summary) */
  readOnly?: boolean;
}

export default function CardsTimeline({ cards, onRemoveCard, readOnly = false }: CardsTimelineProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (cards.length === 0) return null;

  function handleConfirmRemove() {
    if (confirmId) onRemoveCard(confirmId);
    setConfirmId(null);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span aria-hidden="true">🟨</span>
        <span className={styles.headerLabel}>Tarjetas</span>
      </div>

      <div className={styles.list}>
        {cards.map((card) => (
          <div key={card.id} className={`${styles.entry} ${card.cardType === "red" ? styles.entryRed : styles.entryYellow}`}>
            <span className={styles.minute}>{card.minute}&apos;</span>

            <span aria-hidden="true">{card.cardType === "red" ? "🟥" : "🟨"}</span>

            <span className={styles.player}>
              {card.isRivalPlayer
                ? `Rival (#${card.rivalDorsal ?? "?"})`
                : card.playerName ?? "Jugador desconocido"}
            </span>

            <button
              className={styles.removeBtn}
              title="Eliminar tarjeta"
              onClick={() => setConfirmId(card.id)}
              style={readOnly ? { display: "none" } : undefined}
            >
              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm remove dialog */}
      <Dialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
          ¿Eliminar tarjeta?
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.88rem" }}>
          Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setConfirmId(null)} color="inherit" size="small">
            Cancelar
          </Button>
          <Button onClick={handleConfirmRemove} variant="contained" color="error" size="small">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
