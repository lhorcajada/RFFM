import { Box, Button, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { TrainingSession } from "../../../types/training";
import SessionCard from "./SessionCard";
import styles from "./SessionBoardPanel.module.css";

interface SessionBoardPanelProps {
  sessions: TrainingSession[];
  /** subSubPrincipioId → texto, built once from the team's GameModel — forwarded to
   * SessionCard → SessionTargetTree to resolve each target leaf's description. */
  textoMap: Map<string, string>;
  /** subSubPrincipioId set covered by ≥1 session — forwarded to SessionCard → SessionTargetTree
   * so each leaf shows the same "completed" checkmark as the left panel's ADN tree. */
  completedSubSubPrincipioIds?: Set<string>;
  onCreateSession: () => void;
  onRemoveTarget: (sessionId: string, subSubPrincipioId: string) => void;
  onRename: (sessionId: string, name: string) => void;
  onDelete: (sessionId: string) => void;
  onAssignDate: (sessionId: string) => void;
}

/** Right panel of the content-board: sessions as droppable cards, split into "Sin programar"
 * (`date === null`) and "Programadas" (`date !== null`) sections, plus "+ Nueva sesión" —
 * design.md F2/F5 of `season-plan-content-board`. Scheduled sessions stay visible here too so
 * assigning a date doesn't make a session appear to vanish from the board. */
export default function SessionBoardPanel({
  sessions,
  textoMap,
  completedSubSubPrincipioIds,
  onCreateSession,
  onRemoveTarget,
  onRename,
  onDelete,
  onAssignDate,
}: SessionBoardPanelProps) {
  const unscheduled = sessions.filter((s) => s.date === null);
  const scheduled = sessions.filter((s) => s.date !== null);

  const renderCard = (session: TrainingSession) => (
    <SessionCard
      key={session.id}
      session={session}
      textoMap={textoMap}
      completedSubSubPrincipioIds={completedSubSubPrincipioIds}
      onRemoveTarget={onRemoveTarget}
      onRename={onRename}
      onDelete={onDelete}
      onAssignDate={onAssignDate}
    />
  );

  return (
    <Box className={styles.root}>
      <Box className={styles.header}>
        <Button size="small" startIcon={<AddIcon />} variant="contained" onClick={onCreateSession}>
          Nueva sesión
        </Button>
      </Box>

      <Box className={styles.section}>
        <Typography className={styles.sectionTitle}>Sin programar</Typography>
        {unscheduled.length === 0 ? (
          <Typography className={styles.empty}>No hay sesiones sin programar.</Typography>
        ) : (
          unscheduled.map(renderCard)
        )}
      </Box>

      <Box className={styles.section}>
        <Typography className={styles.sectionTitle}>Programadas</Typography>
        {scheduled.length === 0 ? (
          <Typography className={styles.empty}>No hay sesiones programadas.</Typography>
        ) : (
          scheduled.map(renderCard)
        )}
      </Box>
    </Box>
  );
}
