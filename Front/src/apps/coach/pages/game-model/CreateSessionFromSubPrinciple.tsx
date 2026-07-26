import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { useNavigate, useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import trainingService from "../../services/trainingService";
import type { Exercise, CreateSessionRequest, ExerciseSection, SessionExerciseEntry } from "../../types/training";
import styles from "./CreateSessionFromSubPrinciple.module.css";

interface SubPrincipleInfo {
  id: number;
  label: string;
  name: string;
  context: string;
  subSubPrincipleApiIds: string[];
}

interface ScenarioInfo {
  id: number;
  name: string;
  order: number;
}

interface PageState {
  gameMomentName: string;
  zoneName: string;
  scenario: ScenarioInfo;
  subPrinciple: SubPrincipleInfo;
  clubId: string;
  teamId: string;
}

interface ExerciseOption {
  id: string;
  label: string;
  subSubPrincipleId?: string | null;
}

const SECTION_DEFS: { value: ExerciseSection; label: string }[] = [
  { value: "Calentamiento",  label: "Calentamiento" },
  { value: "Principal",      label: "Ejercicios principales" },
  { value: "VueltaALaCalma", label: "Vuelta a la Calma" },
];

export default function CreateSessionFromSubPrinciple() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PageState | null;

  // ── Form state ──────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("");
  const [loc, setLoc] = useState("");

  // ── Exercise state ───────────────────────────────────────────────
  const [allExercises, setAllExercises] = useState<ExerciseOption[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [filterActive, setFilterActive] = useState(true);
  const [selectedBySec, setSelectedBySec] = useState<Record<ExerciseSection, ExerciseOption[]>>({
    Calentamiento: [],
    Principal: [],
    VueltaALaCalma: [],
  });

  // ── Submit state ─────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subSubPrincipleApiIds = state?.subPrinciple?.subSubPrincipleApiIds ?? [];

  useEffect(() => {
    if (!state?.clubId) return;
    setLoadingEx(true);
    trainingService
      .getExercises(state.clubId)
      .then((exs: Exercise[]) => {
        setAllExercises(
          exs.map((e) => ({
            id: e.id,
            label: e.name,
            subSubPrincipleId: e.subSubPrincipleId ?? null,
          }))
        );
      })
      .catch(() => setAllExercises([]))
      .finally(() => setLoadingEx(false));
  }, [state?.clubId]);

  const filteredOptions = filterActive
    ? allExercises.filter(
        (e) =>
          e.subSubPrincipleId != null &&
          subSubPrincipleApiIds.includes(e.subSubPrincipleId)
      )
    : allExercises;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!date) {
      setError("La fecha es obligatoria.");
      return;
    }
    if (!state?.teamId) {
      setError("Equipo no identificado.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const exercises: SessionExerciseEntry[] = SECTION_DEFS.flatMap(sec =>
        selectedBySec[sec.value].map(e => ({ exerciseId: e.id, section: sec.value }))
      );
      const payload: CreateSessionRequest = {
        teamId: state.teamId,
        name: name.trim(),
        description,
        date: new Date(date).toISOString(),
        startTime,
        endTime: endTime || null,
        location: loc || null,
        sportEventId: null,
        subPrincipleId: state.subPrinciple?.id
          ? String(state.subPrinciple.id)
          : null,
        exercises,
      };
      await trainingService.createSession(payload);
      navigate(-1);
    } catch {
      setError("Error al guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  if (!state) {
    return (
      <BaseLayout hideFooterMenu>
        <ContentLayout
          title="Nueva Sesión"
          actionBar={
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
          }
        >
          <Typography>No se encontró el contexto del subprincipio.</Typography>
        </ContentLayout>
      </BaseLayout>
    );
  }

  const { scenario, subPrinciple, gameMomentName, zoneName } = state;

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Nueva Sesión de Entrenamiento"
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
        }
      >
        <Box className={styles.page}>
          {/* ── Context banner ──────────────────────────── */}
          <Box className={styles.contextBanner}>
            <Typography className={styles.breadcrumb}>
              {gameMomentName} · {zoneName}
            </Typography>
            <Typography className={styles.breadcrumb}>
              Escenario {scenario.order} — {scenario.name}
            </Typography>
            <Typography className={styles.subPrincipleTitle}>
              Subprincipio {subPrinciple.label}: {subPrinciple.name}
            </Typography>
            {subPrinciple.context && (
              <Typography className={styles.contextText}>
                {subPrinciple.context}
              </Typography>
            )}
          </Box>

          {/* ── Session form ─────────────────────────────── */}
          <Box className={styles.formCard}>
            <Typography className={styles.sectionTitle}>
              Datos de la sesión
            </Typography>

            <TextField
              label="Nombre *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              className={styles.field}
            />
            <TextField
              label="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              size="small"
              className={styles.field}
            />

            <Box className={styles.row}>
              <TextField
                label="Fecha *"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                className={styles.dateField}
              />
              <TextField
                label="Inicio"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                className={styles.timeField}
              />
              <TextField
                label="Fin (opcional)"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                className={styles.timeField}
              />
            </Box>

            <TextField
              label="Lugar (opcional)"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              fullWidth
              size="small"
              className={styles.field}
            />

            {/* ── Exercise selector ─────────────────────── */}
            <Box className={styles.exerciseSection}>
              <Box className={styles.exerciseSectionHeader}>
                <Typography className={styles.exerciseSectionTitle}>
                  Ejercicios
                </Typography>
                <Chip
                  icon={<FitnessCenterIcon style={{ fontSize: 14 }} />}
                  label={
                    filterActive
                      ? "Filtrado por subprincipio"
                      : "Todos los ejercicios"
                  }
                  size="small"
                  className={styles.filterChip}
                  onClick={() => setFilterActive((v) => !v)}
                  onDelete={filterActive ? () => setFilterActive(false) : undefined}
                />
              </Box>

              {loadingEx ? (
                <Box className={styles.loadingBox}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                SECTION_DEFS.map(sec => (
                  <Box key={sec.value} className={styles.sectionBlock}>
                    <Typography className={styles.sectionBlockLabel}>{sec.label}</Typography>
                    <Autocomplete
                      multiple
                      options={filteredOptions}
                      value={selectedBySec[sec.value]}
                      onChange={(_, val) =>
                        setSelectedBySec(prev => ({ ...prev, [sec.value]: val }))
                      }
                      getOptionLabel={(o) => o.label}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                          const { key, ...tagProps } = getTagProps({ index });
                          return (
                            <Chip
                              key={key}
                              label={option.label}
                              size="small"
                              {...tagProps}
                              className={styles.exerciseChip}
                            />
                          );
                        })
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Añadir ejercicio…"
                        />
                      )}
                      noOptionsText={
                        filterActive && subSubPrincipleApiIds.length > 0
                          ? "No hay ejercicios asociados a este subprincipio"
                          : "No hay ejercicios disponibles"
                      }
                    />
                  </Box>
                ))
              )}
            </Box>
          </Box>

          {/* ── Error + Actions ──────────────────────────── */}
          {error && (
            <Typography className={styles.errorText}>{error}</Typography>
          )}
          <Box className={styles.actionsRow}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(-1)}
            >
              Cancelar
            </Button>
            <Button
              variant="contained"
              size="small"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={saving}
              startIcon={
                saving ? (
                  <CircularProgress size={14} color="inherit" />
                ) : undefined
              }
            >
              Crear sesión
            </Button>
          </Box>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
