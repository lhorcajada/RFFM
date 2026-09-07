import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Box, Button, IconButton, TextField, Tooltip } from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { TrainingSession } from "../../../types/training";
import SessionTargetTree from "./SessionTargetTree";
import styles from "./SessionCard.module.css";

interface SessionCardProps {
  session: TrainingSession;
  /** subSubPrincipioId → texto, built once from the team's GameModel — resolves each target
   * leaf's description client-side (SessionTargetDetail doesn't carry it). */
  textoMap: Map<string, string>;
  /** subSubPrincipioId set covered by ≥1 session (coverage.subSubPrincipios) — forwarded to
   * SessionTargetTree so each leaf shows the same "completed" checkmark as the left panel. */
  completedSubSubPrincipioIds?: Set<string>;
  onRemoveTarget: (sessionId: string, subSubPrincipioId: string) => void;
  onRename: (sessionId: string, name: string) => void;
  onDelete: (sessionId: string) => void;
  onAssignDate: (sessionId: string) => void;
}

/** One droppable card on the content-board's session panel — name (editable inline), targets
 * rendered as a grouped ADN tree, "Asignar fecha", delete. design.md F2/F4/F5 of
 * `season-plan-content-board`. */
export default function SessionCard({
  session,
  textoMap,
  completedSubSubPrincipioIds,
  onRemoveTarget,
  onRename,
  onDelete,
  onAssignDate,
}: SessionCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `session-drop-${session.id}` });
  const [name, setName] = useState(session.name);

  const commitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== session.name) onRename(session.id, trimmed);
    else setName(session.name);
  };

  return (
    <Box ref={setNodeRef} className={`${styles.card} ${isOver ? styles.cardOver : ""}`} data-testid={`session-card-${session.id}`}>
      <Box className={styles.headerRow}>
        <TextField
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          size="small"
          variant="standard"
          className={styles.nameField}
        />
        <Tooltip title="Eliminar sesión">
          <IconButton size="small" aria-label="Eliminar sesión" onClick={() => onDelete(session.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box className={styles.targetsBox}>
        <SessionTargetTree
          targets={session.targets}
          textoMap={textoMap}
          completedSubSubPrincipioIds={completedSubSubPrincipioIds}
          onRemove={(id) => onRemoveTarget(session.id, id)}
        />
      </Box>

      <Box className={styles.actionsRow}>
        <Button size="small" startIcon={<EventIcon />} variant="outlined" onClick={() => onAssignDate(session.id)}>
          Asignar fecha
        </Button>
      </Box>
    </Box>
  );
}
