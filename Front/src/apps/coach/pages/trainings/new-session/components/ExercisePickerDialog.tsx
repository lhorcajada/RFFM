import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PsychologyIcon from "@mui/icons-material/Psychology";
import TacticalBoardSnapshotPreview, {
  hasBoardObjects,
  tryParseBoardSnapshot,
} from "../../../../components/TacticalBoardSnapshotPreview";
import type { Exercise, ExerciseSubtipo, ExerciseTipo } from "../../../../types/training";
import { exerciseMediaUrl } from "../../exerciseMedia";
import { SUBTIPO_LABELS, TIPO_LABELS } from "../../exerciseTypeLabels";
import styles from "./ExercisePickerDialog.module.css";

const TIPO_OPTIONS = Object.keys(TIPO_LABELS) as ExerciseTipo[];

/** Lowercases and strips accents so "posesion" matches "Posesión". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function ExerciseThumbnail({ exercise, teamId }: { exercise: Exercise; teamId?: string }) {
  if (exercise.urlImage) {
    return <img src={exerciseMediaUrl(exercise.urlImage)} alt="" className={styles.thumbnailImage} loading="lazy" />;
  }
  const snapshot = tryParseBoardSnapshot(exercise.boardStateJson);
  if (snapshot && hasBoardObjects(snapshot)) {
    return <TacticalBoardSnapshotPreview snapshot={snapshot} teamId={teamId} />;
  }
  return <PsychologyIcon className={styles.thumbnailFallback} />;
}

interface ExercisePickerDialogProps {
  exercises: Exercise[];
  /** Exercises already in the target block — flagged on their card, still selectable. */
  alreadyAddedIds?: string[];
  /** Team whose roster resolves dorsal/alias in the tactical board thumbnails. */
  teamId?: string;
  onClose: () => void;
  onConfirm: (exerciseIds: string[]) => void;
}

export default function ExercisePickerDialog({
  exercises,
  alreadyAddedIds = [],
  teamId,
  onClose,
  onConfirm,
}: ExercisePickerDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<ExerciseTipo | null>(null);
  const [subtipo, setSubtipo] = useState<ExerciseSubtipo | "">("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const subtipoOptions = useMemo(() => {
    const present = new Set(exercises.map((e) => e.subtipo).filter((s): s is ExerciseSubtipo => !!s));
    return [...present].sort((a, b) => SUBTIPO_LABELS[a].localeCompare(SUBTIPO_LABELS[b], "es"));
  }, [exercises]);

  const visibleExercises = useMemo(() => {
    const term = normalize(search.trim());
    return exercises.filter((exercise) => {
      if (tipo && exercise.tipo !== tipo) return false;
      if (subtipo && exercise.subtipo !== subtipo) return false;
      if (!term) return true;
      return [exercise.name, exercise.objetivo, exercise.descripcion].some((text) => normalize(text ?? "").includes(term));
    });
  }, [exercises, search, tipo, subtipo]);

  const toggleSelected = (exerciseId: string) =>
    setSelectedIds((prev) => (prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId]));

  return (
    <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>Añadir ejercicios</DialogTitle>

      <DialogContent className={styles.content}>
        <Box className={styles.filters}>
          <TextField
            label="Buscar ejercicio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            placeholder="Nombre, objetivo o descripción"
          />

          <Box className={styles.filtersRow}>
            <Box className={styles.tipoChips}>
              <Chip
                label="Todos los tipos"
                size="small"
                onClick={() => setTipo(null)}
                aria-pressed={tipo === null}
                className={`${styles.filterChip} ${tipo === null ? styles.filterChipActive : ""}`}
              />
              {TIPO_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={TIPO_LABELS[option]}
                  size="small"
                  onClick={() => setTipo((prev) => (prev === option ? null : option))}
                  aria-pressed={tipo === option}
                  className={`${styles.filterChip} ${tipo === option ? styles.filterChipActive : ""}`}
                />
              ))}
            </Box>

            {subtipoOptions.length > 0 && (
              <TextField
                select
                label="Subtipo"
                value={subtipo}
                onChange={(e) => setSubtipo(e.target.value as ExerciseSubtipo | "")}
                size="small"
                className={styles.subtipoField}
              >
                <MenuItem value="">Todos</MenuItem>
                {subtipoOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {SUBTIPO_LABELS[option]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>
        </Box>

        {exercises.length === 0 ? (
          <Typography className={styles.empty}>Todavía no hay ejercicios en el club.</Typography>
        ) : visibleExercises.length === 0 ? (
          <Typography className={styles.empty}>Ningún ejercicio coincide con la búsqueda.</Typography>
        ) : (
          <Box className={styles.grid}>
            {visibleExercises.map((exercise) => {
              const isSelected = selectedIds.includes(exercise.id);
              return (
                <button
                  key={exercise.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={exercise.name}
                  onClick={() => toggleSelected(exercise.id)}
                  className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
                >
                  <span className={styles.thumbnail}>
                    <ExerciseThumbnail exercise={exercise} teamId={teamId} />
                    {isSelected && <CheckCircleIcon className={styles.selectedMark} />}
                  </span>
                  <span className={styles.cardName}>{exercise.name}</span>
                  <span className={styles.cardMeta}>
                    <span className={styles.metaChip}>{TIPO_LABELS[exercise.tipo] ?? exercise.tipo}</span>
                    {exercise.subtipo && (
                      <span className={styles.metaChip}>{SUBTIPO_LABELS[exercise.subtipo] ?? exercise.subtipo}</span>
                    )}
                    {exercise.durationMinutes != null && (
                      <span className={styles.metaChip}>{`${exercise.durationMinutes} min`}</span>
                    )}
                  </span>
                  {alreadyAddedIds.includes(exercise.id) && <span className={styles.alreadyAdded}>Ya en el bloque</span>}
                </button>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={selectedIds.length === 0} onClick={() => onConfirm(selectedIds)}>
          {selectedIds.length === 0 ? "Añadir" : `Añadir (${selectedIds.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
