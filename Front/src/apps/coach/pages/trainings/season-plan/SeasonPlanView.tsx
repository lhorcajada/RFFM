import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import type {
  AdnSubprincipioSummary,
  AdnSubSubPrincipioSummary,
  Macrociclo,
  Mesociclo,
  Microciclo,
  SeasonPlan,
} from "../../../types/seasonPlan";
import { GAME_ZONE_LABELS } from "./gameZoneLabels";
import styles from "./SeasonPlanView.module.css";

interface SeasonPlanViewProps {
  plan: SeasonPlan | null;
  loading: boolean;
  onCreatePlan: () => void;
  onCreateExercise: (microcicloId: string) => void;
}

/** ADN chips (Subprincipio/SubSubPrincipio/Habilidad) linked to one Microciclo session —
 * renders nothing when the session has no links (no empty chip row). */
function SessionAdnChips({
  subprincipios,
  subSubPrincipios,
  habilidades,
}: {
  subprincipios: AdnSubprincipioSummary[];
  subSubPrincipios: AdnSubSubPrincipioSummary[];
  habilidades: string[];
}) {
  const hasLinks = subprincipios.length > 0 || subSubPrincipios.length > 0 || habilidades.length > 0;
  if (!hasLinks) return null;

  return (
    <Box className={styles.adnChipsRow}>
      {subprincipios.map((s) => (
        <Chip key={s.id} label={`${s.titulo} ${s.numero}`} size="small" className={styles.adnChip} />
      ))}
      {subSubPrincipios.map((s) => (
        <Chip key={s.id} label={`${s.numero} · ${s.rol}`} size="small" className={styles.adnChip} />
      ))}
      {habilidades.map((h) => (
        <Chip key={h} label={h} size="small" className={styles.habilidadChip} />
      ))}
    </Box>
  );
}

function SessionBlock({
  sessionLabel,
  objetivo,
  subprincipios,
  subSubPrincipios,
  habilidades,
}: {
  sessionLabel: "A" | "B";
  objetivo: string;
  subprincipios: AdnSubprincipioSummary[];
  subSubPrincipios: AdnSubSubPrincipioSummary[];
  habilidades: string[];
}) {
  return (
    <Box className={styles.sessionBlock}>
      <Typography className={styles.sessionLabel}>Sesión {sessionLabel}</Typography>
      <Typography className={styles.sessionObjective}>{objetivo}</Typography>
      <SessionAdnChips subprincipios={subprincipios} subSubPrincipios={subSubPrincipios} habilidades={habilidades} />
    </Box>
  );
}

function MicrocicloRow({ microciclo, onCreateExercise }: { microciclo: Microciclo; onCreateExercise: (id: string) => void }) {
  const hasExercises = microciclo.exerciseCount > 0;

  return (
    <Box className={styles.microcicloCard} data-testid={`microciclo-row-${microciclo.id}`}>
      <Box className={styles.microcicloRow}>
        <Box className={styles.microcicloInfo}>
          <Typography className={styles.microcicloLabel}>{microciclo.weekLabel}</Typography>
          <Typography className={styles.microcicloDates}>
            {microciclo.startDate} – {microciclo.endDate}
          </Typography>
          <Chip
            label={hasExercises ? `${microciclo.exerciseCount} ejercicios` : "Sin ejercicios"}
            size="small"
            color={hasExercises ? "primary" : "warning"}
            className={styles.coverageChip}
          />
        </Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          variant="outlined"
          onClick={() => microciclo.apiId && onCreateExercise(microciclo.apiId)}
          disabled={!microciclo.apiId}
        >
          Crear ejercicio
        </Button>
      </Box>
      <SessionBlock
        sessionLabel="A"
        objetivo={microciclo.objetivoSesionA}
        subprincipios={microciclo.sesionASubprincipios}
        subSubPrincipios={microciclo.sesionASubSubPrincipios}
        habilidades={microciclo.sesionAHabilidades}
      />
      <SessionBlock
        sessionLabel="B"
        objetivo={microciclo.objetivoSesionB}
        subprincipios={microciclo.sesionBSubprincipios}
        subSubPrincipios={microciclo.sesionBSubSubPrincipios}
        habilidades={microciclo.sesionBHabilidades}
      />
    </Box>
  );
}

function MesocicloBlock({ mesociclo, onCreateExercise }: { mesociclo: Mesociclo; onCreateExercise: (id: string) => void }) {
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
            <MicrocicloRow key={microciclo.id} microciclo={microciclo} onCreateExercise={onCreateExercise} />
          ))}
      </AccordionDetails>
    </Accordion>
  );
}

function MacrocicloBlock({ macrociclo, onCreateExercise }: { macrociclo: Macrociclo; onCreateExercise: (id: string) => void }) {
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
            <MesocicloBlock key={mesociclo.id} mesociclo={mesociclo} onCreateExercise={onCreateExercise} />
          ))}
      </AccordionDetails>
    </Accordion>
  );
}

export default function SeasonPlanView({ plan, loading, onCreatePlan, onCreateExercise }: SeasonPlanViewProps) {
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
          <MacrocicloBlock key={macrociclo.id} macrociclo={macrociclo} onCreateExercise={onCreateExercise} />
        ))}
    </Box>
  );
}
