import { useEffect, useState } from "react";
import { Autocomplete, Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import { useLocation, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import trainingService from "../../../services/trainingService";
import seasonPlanService from "../../../services/seasonPlanService";
import seasonService from "../../../services/seasonService";
import type { SessionBlockRequest } from "../../../types/training";
import SessionBlockEditor from "./components/SessionBlockEditor";
import { useSessionForm } from "./hooks/useSessionForm";
import styles from "./NewSessionPage.module.css";

interface NavState {
  returnTo?: string;
  createdExerciseId?: string;
}

interface MicrocicloOption {
  id: string;
  label: string;
}

function useMicrocicloOptions(teamId?: string): MicrocicloOption[] {
  const [options, setOptions] = useState<MicrocicloOption[]>([]);

  useEffect(() => {
    if (!teamId) {
      setOptions([]);
      return;
    }
    let cancelled = false;

    async function load() {
      const activeSeason = await seasonService.getActiveSeason();
      if (!activeSeason?.id) return;
      const plan = await seasonPlanService.getByTeamIdAndSeason(teamId as string, activeSeason.id);
      if (cancelled || !plan) return;

      const flat: MicrocicloOption[] = [];
      for (const macrociclo of plan.macrociclos) {
        for (const mesociclo of macrociclo.mesociclos) {
          for (const microciclo of mesociclo.microciclos) {
            if (microciclo.apiId) {
              flat.push({ id: microciclo.apiId, label: `${mesociclo.name} — ${microciclo.weekLabel}` });
            }
          }
        }
      }
      setOptions(flat);
    }

    void load().catch(() => setOptions([]));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return options;
}

const SESSION_DRAFT_STORAGE_PREFIX = "rffm.session-draft.";

export default function NewSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const clubId = params.get("clubId") ?? "";
  const teamId = params.get("teamId") ?? "";
  const sessionId = params.get("sessionId");
  const microcicloIdParam = params.get("microcicloId");
  const sessionDraftKey = params.get("sessionDraftKey");

  const navState = (location.state as NavState | null) ?? null;
  const returnTo = navState?.returnTo ?? "/coach/trainings";

  const sessionForm = useSessionForm({ teamId, navigate, returnTo, microcicloId: microcicloIdParam });
  const microcicloOptions = useMicrocicloOptions(teamId);

  // Restore an in-progress draft after returning from creating an exercise inline, and
  // append the newly created exercise (if any) to the block that requested it.
  useEffect(() => {
    if (!sessionDraftKey) return;
    const raw = sessionStorage.getItem(SESSION_DRAFT_STORAGE_PREFIX + sessionDraftKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        draft: Record<string, unknown> & { blocks: SessionBlockRequest[] };
        pendingBlockIndex: number;
      };
      const { draft, pendingBlockIndex: restoredIndex } = parsed;
      let blocks = draft.blocks;

      if (navState?.createdExerciseId && restoredIndex != null) {
        blocks = blocks.map((b, i) =>
          i === restoredIndex
            ? {
                ...b,
                exercises: [
                  ...b.exercises,
                  { exerciseId: navState.createdExerciseId as string, position: b.exercises.length + 1 },
                ],
              }
            : b
        );
      }

      Object.entries(draft).forEach(([key, value]) => {
        sessionForm.setField(key as never, (key === "blocks" ? blocks : value) as never);
      });
    } catch {
      // ignore malformed draft
    } finally {
      sessionStorage.removeItem(SESSION_DRAFT_STORAGE_PREFIX + sessionDraftKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDraftKey]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void trainingService.getSessionById(sessionId).then((detail) => {
      if (!cancelled) sessionForm.loadSession(detail);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleRequestInlineExercise = (blockIndex: number) => {
    const key = `${teamId}-${Date.now()}`;
    sessionStorage.setItem(
      SESSION_DRAFT_STORAGE_PREFIX + key,
      JSON.stringify({ draft: sessionForm.form, pendingBlockIndex: blockIndex })
    );
    setPendingBlockIndex(blockIndex);

    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);

    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `/coach/trainings/new-session?${params.toString()}&sessionDraftKey=${key}`, sessionDraftKey: key },
    });
  };

  return (
    <BaseLayout hideFooterMenu>
      <Box className={styles.page}>
        <Box className={styles.topBar}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={sessionForm.handleCancel}
            disabled={sessionForm.saving}
            variant="outlined"
            size="small"
          >
            Cancelar
          </Button>
          <Button
            startIcon={<SaveIcon />}
            onClick={sessionForm.handleSave}
            disabled={sessionForm.saving}
            variant="contained"
            size="small"
            className={styles.saveBtn}
          >
            {sessionForm.saving ? <CircularProgress size={16} /> : "Guardar"}
          </Button>
        </Box>

        <Box className={styles.body}>
          <Typography className={styles.pageTitle}>
            {sessionForm.savedSessionId ? "Editar sesión" : "Nueva sesión de entrenamiento"}
          </Typography>

          <TextField
            label="Nombre"
            value={sessionForm.form.name}
            onChange={(e) => sessionForm.setField("name", e.target.value)}
            fullWidth
            size="small"
            className={styles.field}
          />

          <Autocomplete<MicrocicloOption, false>
            size="small"
            options={microcicloOptions}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={microcicloOptions.find((o) => o.id === sessionForm.form.microcicloId) ?? null}
            onChange={(_, value) => sessionForm.setField("microcicloId", value?.id ?? null)}
            renderInput={(params) => <TextField {...params} label="Ubicación en el plan (opcional)" />}
            className={styles.field}
          />

          <Box className={styles.row}>
            <TextField
              label="Fecha"
              type="date"
              value={sessionForm.form.date}
              onChange={(e) => sessionForm.setField("date", e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              className={styles.dateField}
            />
            <TextField
              label="Inicio"
              type="time"
              value={sessionForm.form.startTime}
              onChange={(e) => sessionForm.setField("startTime", e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              className={styles.timeField}
            />
            <TextField
              label="Fin (opcional)"
              type="time"
              value={sessionForm.form.endTime ?? ""}
              onChange={(e) => sessionForm.setField("endTime", e.target.value || null)}
              size="small"
              InputLabelProps={{ shrink: true }}
              className={styles.timeField}
            />
          </Box>

          <Box className={styles.row}>
            <TextField
              label="Lugar (opcional)"
              value={sessionForm.form.location ?? ""}
              onChange={(e) => sessionForm.setField("location", e.target.value || null)}
              size="small"
              className={styles.flex1}
            />
            <TextField
              label="Evento deportivo ID (opcional)"
              value={sessionForm.form.sportEventId ?? ""}
              onChange={(e) => sessionForm.setField("sportEventId", e.target.value || null)}
              size="small"
              className={styles.flex1}
            />
          </Box>

          <TextField
            label="Objetivo general (opcional)"
            value={sessionForm.form.objetivoGeneral ?? ""}
            onChange={(e) => sessionForm.setField("objetivoGeneral", e.target.value || null)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            className={styles.field}
          />

          <TextField
            label="Mapa de campo general (opcional)"
            value={sessionForm.form.mapaCampoTexto ?? ""}
            onChange={(e) => sessionForm.setField("mapaCampoTexto", e.target.value || null)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            className={styles.field}
            placeholder="Referencia o (pendiente)"
          />

          <Typography className={styles.sectionTitle}>Bloques</Typography>
          <SessionBlockEditor
            blocks={sessionForm.form.blocks}
            onChange={(blocks) => sessionForm.setField("blocks", blocks)}
            clubId={clubId}
            onRequestInlineExercise={handleRequestInlineExercise}
          />

          {sessionForm.error && (
            <Typography color="error" className={styles.error}>
              {sessionForm.error}
            </Typography>
          )}
        </Box>
      </Box>
    </BaseLayout>
  );
}
