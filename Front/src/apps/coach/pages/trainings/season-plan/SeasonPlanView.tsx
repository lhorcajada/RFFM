import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { KeyboardEvent } from "react";
import type { Macrociclo, Mesociclo, Microciclo, SeasonPlan, SessionSummary } from "../../../types/seasonPlan";
import { GAME_ZONE_LABELS } from "./gameZoneLabels";
import styles from "./SeasonPlanView.module.css";

interface SeasonPlanViewProps {
  plan: SeasonPlan | null;
  loading: boolean;
  onCreatePlan: () => void;
  onCreateSession: (microcicloId: string) => void;
  onOpenSession?: (sessionId: string, microcicloId?: string) => void;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function dateBlockParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("es-ES", { day: "2-digit" }),
    month: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
  };
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isCurrentWeek(microciclo: Microciclo, today: string) {
  return microciclo.startDate <= today && today <= microciclo.endDate;
}

function planSummary(plan: SeasonPlan) {
  const microciclos = plan.macrociclos.flatMap((ma) => ma.mesociclos.flatMap((me) => me.microciclos));
  return {
    macrociclos: plan.macrociclos.length,
    sessions: microciclos.reduce((total, mi) => total + mi.sessions.length, 0),
    weeksWithoutSessions: microciclos.filter((mi) => mi.sessions.length === 0).length,
  };
}

function SeasonPlanSummary({ plan }: { plan: SeasonPlan }) {
  const summary = planSummary(plan);
  const stats = [
    { label: "Macrociclos", value: summary.macrociclos, warn: false },
    { label: "Sesiones planificadas", value: summary.sessions, warn: false },
    { label: "Semanas sin sesiones", value: summary.weeksWithoutSessions, warn: summary.weeksWithoutSessions > 0 },
  ];
  return (
    <Box className={styles.summary}>
      {stats.map((stat) => (
        <Box key={stat.label} role="group" aria-label={stat.label} className={styles.summaryStat}>
          <Typography className={`${styles.summaryValue} ${stat.warn ? styles.summaryValueWarn : ""}`}>
            {stat.value}
          </Typography>
          <Typography className={styles.summaryLabel} aria-hidden="true">{stat.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function SessionRow({ session, onOpen }: { session: SessionSummary; onOpen?: (id: string) => void }) {
  const isEditable = Boolean(onOpen);
  const dateBlock = dateBlockParts(session.date);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen?.(session.id);
  };

  return (
    <Box
      className={`${styles.sessionRow} ${isEditable ? styles.sessionRowEditable : ""}`}
      onClick={() => onOpen?.(session.id)}
      onKeyDown={isEditable ? handleKeyDown : undefined}
      role={isEditable ? "button" : undefined}
      tabIndex={isEditable ? 0 : undefined}
      aria-label={isEditable ? `Editar sesión ${session.name}` : undefined}
      data-testid={`session-row-${session.id}`}
    >
      {dateBlock && (
        <Box className={styles.dateBlock} aria-hidden="true">
          <Typography className={styles.dateBlockDay}>{dateBlock.day}</Typography>
          <Typography className={styles.dateBlockMonth}>{dateBlock.month}</Typography>
        </Box>
      )}
      <Box className={styles.sessionRowContent}>
        <Typography className={styles.sessionRowName}>{session.name}</Typography>
        <Box className={styles.sessionRowMeta}>
          <Typography className={styles.sessionRowDate}>{formatDate(session.date)}</Typography>
          <Chip label={`${session.exerciseCount} ej.`} size="small" className={styles.coverageChip} />
        </Box>
        {session.objetivoGeneral && (
          <Typography className={styles.sessionRowObjective}>{session.objetivoGeneral}</Typography>
        )}
      </Box>
      {isEditable && (
        <Box className={styles.sessionRowEdit} aria-hidden="true">
          <EditOutlinedIcon fontSize="small" />
          <Typography className={styles.sessionRowEditLabel}>Editar</Typography>
        </Box>
      )}
    </Box>
  );
}

/** Groups the flat weekly-objective target list (one row per Sub-subprincipio) by Subprincipio
 * for display, per design.md F8's chip label `${numero} · ${titulo} (${count})`. */
function groupWeeklyObjectiveBySubprincipio(targets: Microciclo["weeklyObjective"]) {
  const bySubprincipio = new Map<string, { numero: string; titulo: string; count: number }>();
  for (const target of targets) {
    const existing = bySubprincipio.get(target.subprincipioId);
    if (existing) {
      existing.count += 1;
    } else {
      bySubprincipio.set(target.subprincipioId, {
        numero: target.numero.split(".").slice(0, 2).join(".") || target.numero,
        titulo: target.subprincipioTitulo,
        count: 1,
      });
    }
  }
  return Array.from(bySubprincipio.entries()).map(([subprincipioId, v]) => ({ subprincipioId, ...v }));
}

function MicrocicloRow({
  microciclo,
  today,
  onCreateSession,
  onOpenSession,
}: {
  microciclo: Microciclo;
  today: string;
  onCreateSession: (id: string) => void;
  onOpenSession?: (id: string, microcicloId?: string) => void;
}) {
  const hasSessions = microciclo.sessions.length > 0;
  const isCurrent = isCurrentWeek(microciclo, today);
  const weeklyObjectiveBySubprincipio = groupWeeklyObjectiveBySubprincipio(microciclo.weeklyObjective);
  const hasWeeklyObjective = weeklyObjectiveBySubprincipio.length > 0;

  return (
    <Box
      className={`${styles.microcicloCard} ${isCurrent ? styles.microcicloCardCurrent : ""}`}
      data-testid={`microciclo-row-${microciclo.id}`}
    >
      <Box className={styles.microcicloRow}>
        <Box className={styles.microcicloInfo}>
          <Typography className={styles.microcicloLabel}>{microciclo.weekLabel}</Typography>
          <Typography className={styles.microcicloDates}>
            {microciclo.startDate} – {microciclo.endDate}
          </Typography>
          {isCurrent && <Chip label="Semana actual" size="small" className={styles.currentChip} />}
          <Chip
            label={hasSessions ? `${microciclo.sessions.length} sesiones` : "Sin sesiones"}
            size="small"
            color={hasSessions ? "primary" : "warning"}
            className={styles.coverageChip}
          />
        </Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          variant="outlined"
          className={styles.microcicloAction}
          onClick={() => microciclo.apiId && onCreateSession(microciclo.apiId)}
          disabled={!microciclo.apiId}
        >
          Crear sesión
        </Button>
      </Box>
      {hasWeeklyObjective && (
        <Box className={styles.targetSubprincipiosRow}>
          {weeklyObjectiveBySubprincipio.map((s) => (
            <Chip
              key={s.subprincipioId}
              label={`${s.numero} · ${s.titulo} (${s.count})`}
              size="small"
              className={styles.targetSubprincipioChip}
            />
          ))}
        </Box>
      )}
      {hasSessions && (
        <Box className={styles.sessionsList}>
          {microciclo.sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onOpen={onOpenSession && ((id) => onOpenSession(id, microciclo.apiId))}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function MesocicloBlock({
  mesociclo,
  today,
  onCreateSession,
  onOpenSession,
}: {
  mesociclo: Mesociclo;
  today: string;
  onCreateSession: (id: string) => void;
  onOpenSession?: (id: string, microcicloId?: string) => void;
}) {
  return (
    <Accordion className={styles.accordion} defaultExpanded TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.mesocicloTitle}>{mesociclo.name}</Typography>
        <Chip
          label={GAME_ZONE_LABELS[mesociclo.gameZoneId] ?? "Zona"}
          size="small"
          className={styles.zoneChip}
        />
      </AccordionSummary>
      <AccordionDetails className={styles.microciclosGrid}>
        {mesociclo.microciclos
          .slice()
          .sort((a, b) => b.order - a.order)
          .map((microciclo) => (
            <MicrocicloRow
              key={microciclo.id}
              microciclo={microciclo}
              today={today}
              onCreateSession={onCreateSession}
              onOpenSession={onOpenSession}
            />
          ))}
      </AccordionDetails>
    </Accordion>
  );
}

function MacrocicloBlock({
  macrociclo,
  today,
  onCreateSession,
  onOpenSession,
}: {
  macrociclo: Macrociclo;
  today: string;
  onCreateSession: (id: string) => void;
  onOpenSession?: (id: string, microcicloId?: string) => void;
}) {
  return (
    <Accordion className={styles.accordion} defaultExpanded TransitionProps={{ unmountOnExit: true }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography className={styles.macrocicloTitle}>{macrociclo.name}</Typography>
      </AccordionSummary>
      <AccordionDetails className={styles.details}>
        {macrociclo.mesociclos
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((mesociclo) => (
            <MesocicloBlock
              key={mesociclo.id}
              mesociclo={mesociclo}
              today={today}
              onCreateSession={onCreateSession}
              onOpenSession={onOpenSession}
            />
          ))}
      </AccordionDetails>
    </Accordion>
  );
}

export default function SeasonPlanView({ plan, loading, onCreatePlan, onCreateSession, onOpenSession }: SeasonPlanViewProps) {
  if (loading) {
    return (
      <Box className={styles.loadingBox}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!plan) {
    return (
      <Box className={styles.emptyState}>
        <Typography className={styles.emptyText}>
          No hay planificación de temporada creada para este equipo.
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={onCreatePlan} className={styles.createBtn}>
          Crear planificación
        </Button>
      </Box>
    );
  }

  const today = todayIso();

  return (
    <Box className={styles.tree}>
      <SeasonPlanSummary plan={plan} />
      {plan.macrociclos
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((macrociclo) => (
          <MacrocicloBlock
            key={macrociclo.id}
            macrociclo={macrociclo}
            today={today}
            onCreateSession={onCreateSession}
            onOpenSession={onOpenSession}
          />
        ))}
    </Box>
  );
}
