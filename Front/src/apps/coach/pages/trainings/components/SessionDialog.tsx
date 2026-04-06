import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Autocomplete,
  Chip,
} from "@mui/material";
import type { TrainingSession, CreateSessionRequest, UpdateSessionRequest, Exercise, ExerciseSection, SessionExerciseEntry } from "../../../types/training";
import trainingService from "../../../services/trainingService";
import styles from "./SessionDialog.module.css";

interface Props {
  open: boolean;
  teamId: string;
  clubId: string;
  session?: TrainingSession | null;
  onClose: () => void;
  onSaved: () => void;
}

interface ExerciseOption {
  id: string;
  label: string;
}

function formatDate(d: string) {
  if (!d) return "";
  return d.slice(0, 10); // YYYY-MM-DD
}

function formatTime(t: string) {
  if (!t) return "";
  // HH:MM:SS → HH:MM
  return t.slice(0, 5);
}

const SECTION_DEFS: { value: ExerciseSection; label: string }[] = [
  { value: "Calentamiento",  label: "Calentamiento" },
  { value: "Principal",      label: "Ejercicios principales" },
  { value: "VueltaALaCalma", label: "Vuelta a la Calma" },
];

export default function SessionDialog({ open, teamId, clubId, session, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [sportEventId, setSportEventId] = useState("");
  const [selectedBySec, setSelectedBySec] = useState<Record<ExerciseSection, ExerciseOption[]>>({
    Calentamiento: [],
    Principal: [],
    VueltaALaCalma: [],
  });
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]); 
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load exercises for this club
  useEffect(() => {
    if (!open || !clubId) return;
    setLoadingExercises(true);
    trainingService.getExercises(clubId)
      .then((exs: Exercise[]) => {
        setExerciseOptions(exs.map(e => ({ id: e.id, label: e.name })));
      })
      .catch(() => setExerciseOptions([]))
      .finally(() => setLoadingExercises(false));
  }, [open, clubId]);

  // Reset form on open
  useEffect(() => {
    if (!open) return;
    if (session) {
      setName(session.name);
      setDescription(session.description ?? "");
      setDate(formatDate(session.date));
      setStartTime(formatTime(session.startTime));
      setEndTime(session.endTime ? formatTime(session.endTime) : "");
      setLocation(session.location ?? "");
      setSportEventId(session.sportEventId ?? "");
    } else {
      setName("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime("10:00");
      setEndTime("");
      setLocation("");
      setSportEventId("");
      setSelectedBySec({ Calentamiento: [], Principal: [], VueltaALaCalma: [] });
    }
    setError(null);
  }, [open, session]);

  const handleSave = async () => {
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    if (!date) { setError("La fecha es obligatoria."); return; }
    setSaving(true);
    setError(null);
    try {
      const exercises: SessionExerciseEntry[] = SECTION_DEFS.flatMap(sec =>
        selectedBySec[sec.value].map(e => ({ exerciseId: e.id, section: sec.value }))
      );
      const payload = {
        name: name.trim(),
        description,
        date: new Date(date).toISOString(),
        startTime,
        endTime: endTime || null,
        location: location || null,
        sportEventId: sportEventId || null,
        exercises,
      };
      if (session) {
        await trainingService.updateSession(session.id, payload as UpdateSessionRequest);
      } else {
        await trainingService.createSession({ ...payload, teamId } as CreateSessionRequest);
      }
      onSaved();
    } catch {
      setError("Error al guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ className: styles.paper }}>
      <DialogTitle className={styles.title}>
        {session ? "Editar sesión" : "Nueva sesión de entrenamiento"}
      </DialogTitle>
      <DialogContent className={styles.content}>
        <TextField
          label="Nombre"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth size="small" className={styles.field}
        />
        <TextField
          label="Descripción"
          value={description}
          onChange={e => setDescription(e.target.value)}
          fullWidth multiline minRows={2} size="small" className={styles.field}
        />
        <Box className={styles.row}>
          <TextField
            label="Fecha"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            className={styles.dateField}
          />
          <TextField
            label="Inicio"
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            className={styles.timeField}
          />
          <TextField
            label="Fin (opcional)"
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            className={styles.timeField}
          />
        </Box>
        <Box className={styles.row}>
          <TextField
            label="Lugar (opcional)"
            value={location}
            onChange={e => setLocation(e.target.value)}
            size="small"
            className={styles.flex1}
          />
          <TextField
            label="Evento deportivo ID (opcional)"
            value={sportEventId}
            onChange={e => setSportEventId(e.target.value)}
            size="small"
            className={styles.flex1}
          />
        </Box>
        <Autocomplete
          multiple
          options={exerciseOptions}
          value={selectedBySec["Calentamiento"]}
          onChange={(_, val) => setSelectedBySec(prev => ({ ...prev, Calentamiento: val }))}
          getOptionLabel={o => o.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={loadingExercises}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip key={key} label={option.label} size="small" {...tagProps}
                  className={styles.exerciseChip} />
              );
            })
          }
          renderInput={params => (
            <TextField {...params} label="Calentamiento" placeholder="Buscar ejercicios…"
              size="small" className={styles.field}
              InputProps={{ ...params.InputProps, endAdornment: (<>{loadingExercises && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>) }}
            />
          )}
          className={styles.autocomplete}
        />
        <Autocomplete
          multiple
          options={exerciseOptions}
          value={selectedBySec["Principal"]}
          onChange={(_, val) => setSelectedBySec(prev => ({ ...prev, Principal: val }))}
          getOptionLabel={o => o.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={loadingExercises}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip key={key} label={option.label} size="small" {...tagProps}
                  className={styles.exerciseChip} />
              );
            })
          }
          renderInput={params => (
            <TextField {...params} label="Ejercicios principales" placeholder="Buscar ejercicios…"
              size="small" className={styles.field}
              InputProps={{ ...params.InputProps, endAdornment: (<>{loadingExercises && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>) }}
            />
          )}
          className={styles.autocomplete}
        />
        <Autocomplete
          multiple
          options={exerciseOptions}
          value={selectedBySec["VueltaALaCalma"]}
          onChange={(_, val) => setSelectedBySec(prev => ({ ...prev, VueltaALaCalma: val }))}
          getOptionLabel={o => o.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={loadingExercises}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip key={key} label={option.label} size="small" {...tagProps}
                  className={styles.exerciseChip} />
              );
            })
          }
          renderInput={params => (
            <TextField {...params} label="Vuelta a la Calma" placeholder="Buscar ejercicios…"
              size="small" className={styles.field}
              InputProps={{ ...params.InputProps, endAdornment: (<>{loadingExercises && <CircularProgress size={14} />}{params.InputProps.endAdornment}</>) }}
            />
          )}
          className={styles.autocomplete}
        />
        {error && <Typography color="error" className={styles.error}>{error}</Typography>}
      </DialogContent>
      <DialogActions className={styles.actions}>
        <Button onClick={onClose} disabled={saving} className={styles.cancelBtn}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" className={styles.saveBtn}>
          {saving ? <CircularProgress size={16} /> : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
