import { useMemo, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import type { TrainingSession } from "../../../types/training";
import { groupSessions } from "../sessionsGrouping";
import styles from "./SessionsList.module.css";

export const FREE_PAGE_SIZE = 10;

type SessionActions = {
  onToggleSelected: (sessionId: string) => void;
  onView: (sessionId: string) => void;
  onPrint: (sessionId: string) => void;
  onEdit: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

type Props = SessionActions & {
  sessions: TrainingSession[];
  selectedIds: string[];
};

function formatDate(iso: string | null) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function formatTime(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

function countLabel(count: number) {
  return count === 1 ? "1 sesión" : `${count} sesiones`;
}

function countSessions<T>(items: T[], count: (item: T) => number) {
  return items.reduce((total, item) => total + count(item), 0);
}

function SessionCard({ session, selected, actions }: { session: TrainingSession; selected: boolean; actions: SessionActions }) {
  return (
    <Box className={styles.sessionCard}>
      <Checkbox size="small" checked={selected} onChange={() => actions.onToggleSelected(session.id)} />
      <Box className={styles.sessionInfo}>
        <Typography className={styles.sessionName}>{session.name}</Typography>
        <Typography className={styles.sessionDate}>{formatDate(session.date)}</Typography>
        <Box className={styles.sessionMeta}>
          <Typography className={styles.sessionMetaText}>
            {formatTime(session.startTime)}
            {session.endTime ? ` – ${formatTime(session.endTime)}` : ""}
            {session.location ? ` · ${session.location}` : ""}
          </Typography>
          <Chip label={`${session.exerciseCount} ej.`} size="small" className={styles.countChip} />
          {session.sportEventName && <Chip label={session.sportEventName} size="small" className={styles.eventChip} />}
        </Box>
      </Box>
      <Box className={styles.sessionActions}>
        <Tooltip title="Visualizar">
          <IconButton size="small" className={styles.iconBtn} onClick={() => actions.onView(session.id)}>
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Imprimir PDF">
          <IconButton size="small" className={styles.iconBtn} onClick={() => actions.onPrint(session.id)}>
            <PrintOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Editar">
          <IconButton size="small" className={styles.iconBtn} onClick={() => actions.onEdit(session.id)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton size="small" className={styles.deleteIconBtn} onClick={() => actions.onDelete(session.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function Group({
  title,
  subtitle,
  level,
  defaultExpanded,
  children,
}: {
  title: string;
  subtitle?: string;
  level: "macro" | "meso" | "micro" | "free";
  defaultExpanded: boolean;
  children: ReactNode;
}) {
  return (
    <Accordion className={`${styles.group} ${styles[level]}`} defaultExpanded={defaultExpanded} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon className={styles.expandIcon} />}>
        <Box className={styles.groupSummary}>
          <Typography className={styles.groupTitle}>{title}</Typography>
          {subtitle && <Typography className={styles.groupSubtitle}>{subtitle}</Typography>}
        </Box>
      </AccordionSummary>
      <AccordionDetails className={styles.groupDetails}>{children}</AccordionDetails>
    </Accordion>
  );
}

export default function SessionsList({ sessions, selectedIds, ...actions }: Props) {
  const groups = useMemo(() => groupSessions(sessions), [sessions]);
  const [freeVisible, setFreeVisible] = useState(FREE_PAGE_SIZE);

  const renderCard = (session: TrainingSession) => (
    <SessionCard key={session.id} session={session} selected={selectedIds.includes(session.id)} actions={actions} />
  );

  return (
    <Box className={styles.list}>
      {groups.macrociclos.map((macro, macroIndex) => (
        <Group
          key={macro.id}
          level="macro"
          title={macro.name}
          subtitle={countLabel(countSessions(macro.mesociclos, (me) => countSessions(me.microciclos, (mi) => mi.sessions.length)))}
          defaultExpanded={macroIndex === 0}
        >
          {macro.mesociclos.map((meso, mesoIndex) => (
            <Group
              key={meso.id}
              level="meso"
              title={meso.name}
              subtitle={countLabel(countSessions(meso.microciclos, (mi) => mi.sessions.length))}
              defaultExpanded={macroIndex === 0 && mesoIndex === 0}
            >
              {meso.microciclos.map((micro, microIndex) => (
                <Group
                  key={micro.id}
                  level="micro"
                  title={`${micro.label} · ${countLabel(micro.sessions.length)}`}
                  subtitle={micro.startDate && micro.endDate ? `${formatShortDate(micro.startDate)} – ${formatShortDate(micro.endDate)}` : undefined}
                  defaultExpanded={macroIndex === 0 && mesoIndex === 0 && microIndex === 0}
                >
                  {micro.sessions.map(renderCard)}
                </Group>
              ))}
            </Group>
          ))}
        </Group>
      ))}

      {groups.free.length > 0 && (
        <Group level="free" title={`Sesiones libres · ${countLabel(groups.free.length)}`} defaultExpanded>
          {groups.free.slice(0, freeVisible).map(renderCard)}
          {groups.free.length > freeVisible && (
            <Box className={styles.moreRow}>
              <Button size="small" variant="outlined" onClick={() => setFreeVisible((v) => v + FREE_PAGE_SIZE)}>
                Ver más
              </Button>
            </Box>
          )}
        </Group>
      )}
    </Box>
  );
}
