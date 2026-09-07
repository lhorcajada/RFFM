import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import type { Macrociclo, Mesociclo, Microciclo, SeasonPlan, SessionSummary } from "../../../types/seasonPlan";
import { GAME_ZONE_LABELS } from "./gameZoneLabels";
import styles from "./SeasonPlanView.module.css";

interface SeasonPlanViewProps {
  plan: SeasonPlan | null;
  loading: boolean;
  onCreatePlan: () => void;
  onCreateSession: (microcicloId: string) => void;
  onOpenSession?: (sessionId: string) => void;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function SessionRow({ session, onOpen }: { session: SessionSummary; onOpen?: (id: string) => void }) {
  return (
    <Box
      className={styles.sessionRow}
      onClick={() => onOpen?.(session.id)}
      role={onOpen ? "button" : undefined}
      data-testid={`session-row-${session.id}`}
    >
      <Typography className={styles.sessionRowName}>{session.name}</Typography>
      <Box className={styles.sessionRowMeta}>
        <Typography className={styles.sessionRowDate}>{formatDate(session.date)}</Typography>
        <Chip label={`${session.exerciseCount} ej.`} size="small" className={styles.coverageChip} />
      </Box>
      {session.objetivoGeneral && (
        <Typography className={styles.sessionRowObjective}>{session.objetivoGeneral}</Typography>
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
  onCreateSession,
  onOpenSession,
}: {
  microciclo: Microciclo;
  onCreateSession: (id: string) => void;
  onOpenSession?: (id: string) => void;
}) {
  const hasSessions = microciclo.sessions.length > 0;
  const weeklyObjectiveBySubprincipio = groupWeeklyObjectiveBySubprincipio(microciclo.weeklyObjective);
  const hasWeeklyObjective = weeklyObjectiveBySubprincipio.length > 0;

  return (
    <Box className={styles.microcicloCard} data-testid={`microciclo-row-${microciclo.id}`}>
      <Box className={styles.microcicloRow}>
        <Box className={styles.microcicloInfo}>
          <Typography className={styles.microcicloLabel}>{microciclo.weekLabel}</Typography>
          <Typography className={styles.microcicloDates}>
            {microciclo.startDate} – {microciclo.endDate}
          </Typography>
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
            <SessionRow key={session.id} session={session} onOpen={onOpenSession} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function MesocicloBlock({
  mesociclo,
  onCreateSession,
  onOpenSession,
}: {
  mesociclo: Mesociclo;
  onCreateSession: (id: string) => void;
  onOpenSession?: (id: string) => void;
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
      <AccordionDetails className={styles.details}>
        {mesociclo.microciclos
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((microciclo) => (
            <MicrocicloRow
              key={microciclo.id}
              microciclo={microciclo}
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
  onCreateSession,
  onOpenSession,
}: {
  macrociclo: Macrociclo;
  onCreateSession: (id: string) => void;
  onOpenSession?: (id: string) => void;
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

  return (
    <Box className={styles.tree}>
      {plan.macrociclos
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((macrociclo) => (
          <MacrocicloBlock
            key={macrociclo.id}
            macrociclo={macrociclo}
            onCreateSession={onCreateSession}
            onOpenSession={onOpenSession}
          />
        ))}
    </Box>
  );
}
