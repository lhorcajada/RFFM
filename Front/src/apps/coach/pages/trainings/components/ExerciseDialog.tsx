import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Divider,
  IconButton,
  Chip,
  type SelectChangeEvent,
} from "@mui/material";
import { client } from "../../../../../core/api/client";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import type { Exercise, CreateExerciseRequest, UpdateExerciseRequest, ExerciseType, ExerciseSection, ExerciseCondition } from "../../../types/training";
import trainingService from "../../../services/trainingService";
import styles from "./ExerciseDialog.module.css";

interface Props {
  open: boolean;
  clubId: string;
  exercise?: Exercise | null;
  onClose: () => void;
  onSaved: () => void;
}

const typeOptions: { value: ExerciseType; label: string }[] = [
  { value: "Physical", label: "Físico" },
  { value: "Technical", label: "Técnico" },
  { value: "Tactical", label: "Táctico" },
  { value: "Game", label: "Juego" },
  { value: "Cognitive", label: "Cognitivo" },
  { value: "Psychological", label: "Psicológico" },
];

const sectionOptions: { value: ExerciseSection; label: string }[] = [
  { value: "Calentamiento", label: "Calentamiento" },
  { value: "Principal", label: "Principal" },
  { value: "VueltaALaCalma", label: "Vuelta a la Calma" },
];

const empty: CreateExerciseRequest = {
  clubId: "",
  name: "",
  description: "",
  types: ["Tactical"],
  section: "Principal",
  durationTotal: 15,
  playersNumber: 10,
  goalPeekersNumber: 1,
  fieldSpace: "",
  touchesNumber: 0,
  wildCards: 0,
  series: 0,
  durationSeries: 0,
  restSeries: 0,
};

export default function ExerciseDialog({ open, clubId, exercise, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CreateExerciseRequest>({ ...empty, clubId });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Conditions
  const [conditions, setConditions] = useState<ExerciseCondition[]>([]);
  const [conditionInput, setConditionInput] = useState("");
  const [editingCondition, setEditingCondition] = useState<{ id: string; text: string } | null>(null);
  const [savingCondition, setSavingCondition] = useState(false);
  const [savedExerciseId, setSavedExerciseId] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (exercise) {
      setForm({
        clubId,
        name: exercise.name,
        description: exercise.description,
        types: exercise.types,
        section: exercise.section,
        durationTotal: exercise.durationTotal,
        playersNumber: exercise.playersNumber,
        goalPeekersNumber: exercise.goalPeekersNumber,
        fieldSpace: exercise.fieldSpace,
        touchesNumber: exercise.touchesNumber ?? 0,
        wildCards: exercise.wildCards ?? 0,
        series: exercise.series ?? 0,
        durationSeries: exercise.durationSeries ?? 0,
        restSeries: exercise.restSeries ?? 0,
      });
    } else {
      setForm({ ...empty, clubId });
    }
    setError(null);
    setPendingFile(null);
    setConditionInput("");
    setEditingCondition(null);
    setSavedExerciseId(exercise?.id ?? null);
    setConditions(exercise?.conditions ?? []);
    // Build preview URL from existing urlImage
    if (exercise?.urlImage) {
      const base = (client.defaults.baseURL ?? "/").replace(/\/$/, "");
      setPreviewUrl(`${base}/api/local-storage/${exercise.urlImage}`);
    } else {
      setPreviewUrl(null);
    }
  }, [open, exercise, clubId]);

  const setField = (field: keyof CreateExerciseRequest, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPendingFile(file);
    // Show local object URL as preview while not yet uploaded
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveMedia = () => {
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
    if (form.types.length === 0) { setError("Selecciona al menos un tipo."); return; }
    setSaving(true);
    setError(null);
    try {
      let exerciseId: string;
      if (exercise) {
        exerciseId = exercise.id;
        const { clubId: _c, ...update }: CreateExerciseRequest = form;
        await trainingService.updateExercise(exerciseId, update as UpdateExerciseRequest);
      } else {
        const created = await trainingService.createExercise(form);
        exerciseId = created.id;
      }
      if (pendingFile) {
        await trainingService.uploadExerciseMedia(exerciseId, pendingFile);
      }
      setSavedExerciseId(exerciseId);
      onSaved();
    } catch {
      setError("Error al guardar el ejercicio.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCondition = async () => {
    const text = conditionInput.trim();
    if (!text || !savedExerciseId) return;
    setSavingCondition(true);
    try {
      const added = await trainingService.createCondition(savedExerciseId, text);
      setConditions(prev => [...prev, added]);
      setConditionInput("");
    } finally {
      setSavingCondition(false);
    }
  };

  const handleSaveEditCondition = async () => {
    if (!editingCondition) return;
    const text = editingCondition.text.trim();
    if (!text) return;
    setSavingCondition(true);
    try {
      const updated = await trainingService.updateCondition(editingCondition.id, text);
      setConditions(prev => prev.map(c => c.id === updated.id ? updated : c));
      setEditingCondition(null);
    } finally {
      setSavingCondition(false);
    }
  };

  const handleDeleteCondition = async (conditionId: string) => {
    setSavingCondition(true);
    try {
      await trainingService.deleteCondition(conditionId);
      setConditions(prev => prev.filter(c => c.id !== conditionId));
    } finally {
      setSavingCondition(false);
    }
  };

  const isPhysical = form.types.includes("Physical");
  const isTechTac = form.types.includes("Technical") || form.types.includes("Tactical");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ className: styles.paper }}>
      <DialogTitle className={styles.title}>
        {exercise ? "Editar ejercicio" : "Nuevo ejercicio"}
      </DialogTitle>
      <DialogContent className={styles.content}>
        <TextField
          label="Nombre"
          value={form.name}
          onChange={e => setField("name", e.target.value)}
          fullWidth size="small" className={styles.field}
        />
        <TextField
          label="Descripción"
          value={form.description}
          onChange={e => setField("description", e.target.value)}
          fullWidth multiline minRows={2} size="small" className={styles.field}
        />
        <Box className={styles.row}>
          <FormControl size="small" className={styles.typeSelect}>
            <InputLabel>Tipo</InputLabel>
            <Select
              multiple
              value={form.types}
              label="Tipo"
              onChange={(e: SelectChangeEvent<ExerciseType[]>) => {
                const value = e.target.value;
                setField("types", typeof value === "string" ? value.split(",") : value);
              }}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {(selected as ExerciseType[]).map((v) => (
                    <Chip key={v} label={typeOptions.find((o) => o.value === v)?.label ?? v} size="small" />
                  ))}
                </Box>
              )}
            >
              {typeOptions.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" className={styles.typeSelect}>
            <InputLabel>Sección</InputLabel>
            <Select
              value={form.section}
              label="Sección"
              onChange={(e: SelectChangeEvent) => setField("section", e.target.value as ExerciseSection)}
            >
              {sectionOptions.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Duración total (min)"
            type="number"
            value={form.durationTotal}
            onChange={e => setField("durationTotal", Number(e.target.value))}
            size="small"
            inputProps={{ min: 1 }}
            className={styles.numField}
          />
        </Box>
        <Box className={styles.row}>
          <TextField
            label="Jugadores"
            type="number"
            value={form.playersNumber}
            onChange={e => setField("playersNumber", Number(e.target.value))}
            size="small"
            inputProps={{ min: 1 }}
            className={styles.numField}
          />
          <TextField
            label="Porteros"
            type="number"
            value={form.goalPeekersNumber}
            onChange={e => setField("goalPeekersNumber", Number(e.target.value))}
            size="small"
            inputProps={{ min: 0 }}
            className={styles.numField}
          />
          <TextField
            label="Espacio"
            value={form.fieldSpace}
            onChange={e => setField("fieldSpace", e.target.value)}
            size="small"
            placeholder="p. ej. 20x30m"
            className={styles.numField}
          />
        </Box>

        {/* Physical-specific */}
        {isPhysical && (
          <Box className={styles.row}>
            <TextField label="Series" type="number" value={form.series}
              onChange={e => setField("series", Number(e.target.value))}
              size="small" inputProps={{ min: 0 }} className={styles.numField} />
            <TextField label="Dur. serie (s)" type="number" value={form.durationSeries}
              onChange={e => setField("durationSeries", Number(e.target.value))}
              size="small" inputProps={{ min: 0 }} className={styles.numField} />
            <TextField label="Descanso (s)" type="number" value={form.restSeries}
              onChange={e => setField("restSeries", Number(e.target.value))}
              size="small" inputProps={{ min: 0 }} className={styles.numField} />
          </Box>
        )}

        {/* Technical/Tactical-specific */}
        {isTechTac && (
          <Box className={styles.row}>
            <TextField label="Toques" type="number" value={form.touchesNumber}
              onChange={e => setField("touchesNumber", Number(e.target.value))}
              size="small" inputProps={{ min: 0 }} className={styles.numField} />
            <TextField label="Comodines" type="number" value={form.wildCards}
              onChange={e => setField("wildCards", Number(e.target.value))}
              size="small" inputProps={{ min: 0 }} className={styles.numField} />
          </Box>
        )}

        <Divider className={styles.divider} />
        <Typography className={styles.skillsTitle}>Condiciones</Typography>
        {!savedExerciseId ? (
          <Typography className={styles.noSkills}>
            Guarda el ejercicio primero para poder añadir condiciones.
          </Typography>
        ) : (
          <Box className={styles.conditionsSection}>
            {/* List */}
            {conditions.map(c => (
              <Box key={c.id} className={styles.conditionRow}>
                {editingCondition?.id === c.id ? (
                  <>
                    <TextField
                      value={editingCondition.text}
                      onChange={e => setEditingCondition(prev => prev ? { ...prev, text: e.target.value } : null)}
                      size="small"
                      fullWidth
                      autoFocus
                      className={styles.field}
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEditCondition(); if (e.key === "Escape") setEditingCondition(null); }}
                    />
                    <IconButton size="small" className={styles.conditionSaveBtn} onClick={handleSaveEditCondition} disabled={savingCondition}>
                      ✓
                    </IconButton>
                    <IconButton size="small" className={styles.conditionCancelBtn} onClick={() => setEditingCondition(null)}>
                      ✕
                    </IconButton>
                  </>
                ) : (
                  <>
                    <Typography className={styles.conditionText}>
                      <span className={styles.conditionBullet}>•</span> {c.text}
                    </Typography>
                    <Box className={styles.conditionActions}>
                      <IconButton size="small" className={styles.conditionEditBtn} onClick={() => setEditingCondition({ id: c.id, text: c.text })}>
                        <EditIcon style={{ fontSize: 12 }} />
                      </IconButton>
                      <IconButton size="small" className={styles.conditionDeleteBtn} onClick={() => handleDeleteCondition(c.id)} disabled={savingCondition}>
                        <DeleteIcon style={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                  </>
                )}
              </Box>
            ))}
            {/* Add new */}
            <Box className={styles.conditionAddRow}>
              <TextField
                value={conditionInput}
                onChange={e => setConditionInput(e.target.value)}
                size="small"
                placeholder="Nueva condición..."
                fullWidth
                className={styles.field}
                onKeyDown={e => { if (e.key === "Enter") handleAddCondition(); }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={handleAddCondition}
                disabled={!conditionInput.trim() || savingCondition}
                className={styles.uploadBtn}
              >
                Añadir
              </Button>
            </Box>
          </Box>
        )}

        {/* Media upload */}
        <Divider className={styles.divider} />
        <Typography className={styles.skillsTitle}>Imagen / Video</Typography>
        <Box className={styles.mediaSection}>
          {previewUrl && (
            <Box className={styles.mediaPreviewWrap}>
              {pendingFile?.type.startsWith("video/") ||
              (!pendingFile && exercise?.urlImage && /\.(mp4|webm|ogg)$/i.test(exercise.urlImage ?? "")) ? (
                <video
                  src={previewUrl}
                  controls
                  className={styles.mediaPreview}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  className={styles.mediaPreview}
                />
              )}
              <IconButton
                size="small"
                onClick={handleRemoveMedia}
                className={styles.mediaRemoveBtn}
                title="Quitar medio"
              >
                ✕
              </IconButton>
            </Box>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm"
            style={{ display: "none" }}
            onChange={handleFileChange}
            id="exercise-media-input"
          />
          <label htmlFor="exercise-media-input">
            <Button
              component="span"
              size="small"
              variant="outlined"
              className={styles.uploadBtn}
            >
              {previewUrl ? "Cambiar archivo" : "Subir imagen / video"}
            </Button>
          </label>
        </Box>

        {error && <Typography color="error" className={styles.error}>{error}</Typography>}
      </DialogContent>
      <DialogActions className={styles.actions}>
        <Button onClick={onClose} disabled={saving} className={styles.cancelBtn}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving} variant="contained" className={styles.saveBtn}>
          {saving ? <CircularProgress size={16} /> : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
