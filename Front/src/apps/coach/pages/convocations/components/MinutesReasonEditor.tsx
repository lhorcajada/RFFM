import { useState } from "react";
import { Button } from "@mui/material";
import EditNoteIcon from "@mui/icons-material/EditNote";
import MinutesReasonsListDialog, {
  type PlayerMinutesReason,
} from "./MinutesReasonsListDialog";
import styles from "./MinutesReasonEditor.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  players: PlayerMinutesReason[];
  /** Persists (or clears) a single player's reason. Never required to save the
   *  lineup/close the match — purely additive and optional. */
  onSave: (playerId: string, reason: string | null) => Promise<void>;
  disabled?: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

/** Single button that opens one dialog listing every player's minutes reason, editable
 *  inline within that same dialog. Never blocks saving the lineup/closing a match. */
export default function MinutesReasonEditor({ players, onSave, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const countWithReason = players.filter((p) => p.reason && p.reason.trim().length > 0).length;
  const ariaLabel =
    countWithReason > 0
      ? `Motivos de minutos (${countWithReason} con motivo guardado)`
      : "Motivos de minutos";

  return (
    <>
      <Button
        type="button"
        variant="outlined"
        size="small"
        className={styles.triggerBtn}
        startIcon={<EditNoteIcon fontSize="small" />}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Motivos de minutos
        {countWithReason > 0 && (
          <span className={styles.countBadge}>{countWithReason}</span>
        )}
      </Button>
      <MinutesReasonsListDialog
        open={open}
        players={players}
        onClose={() => setOpen(false)}
        onSave={onSave}
      />
    </>
  );
}
