import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { tipoOptions } from "../constants";
import type { ExerciseFormState } from "../hooks/useExerciseForm";
import styles from "../NewExercisePage.module.css";
import type { ExerciseTipo } from "../../../../types/training";
import ModelRelationSection from "./ModelRelationSection";
import NivelesEditor from "./NivelesEditor";

interface ExerciseFormPanelProps {
  panelVisible: boolean;
  form: ExerciseFormState;
  teamId?: string;
}

export default function ExerciseFormPanel({ panelVisible, form, teamId }: ExerciseFormPanelProps) {
  const {
    form: formData,
    setField,
    error,
    pendingFile,
    previewUrl,
    fileInputRef,
    handleFileChange,
    handleRemoveMedia,
  } = form;

  return (
    <Box className={`${styles.formPanel} ${panelVisible ? styles.formPanelVisible : ""}`}>
      <Box className={styles.panelHeader}>
        <Typography className={styles.panelTitle}>
          {form.savedExerciseId ? "Editar ejercicio" : "Nuevo ejercicio"}
        </Typography>
      </Box>

      <Box className={styles.panelBody}>
        <Box className={styles.panelBodyGrid}>
          <TextField
            label="Título"
            value={formData.name}
            onChange={(e) => setField("name", e.target.value)}
            fullWidth
            size="small"
            className={`${styles.field} ${styles.fullWidthRow}`}
          />

          <FormControl size="small" className={styles.typeSelect}>
            <InputLabel id="exercise-tipo-label">Tipo</InputLabel>
            <Select
              labelId="exercise-tipo-label"
              label="Tipo"
              value={formData.tipo}
              onChange={(e: SelectChangeEvent) => setField("tipo", e.target.value as ExerciseTipo)}
            >
              {tipoOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Duración (min)"
            type="number"
            value={formData.durationMinutes ?? ""}
            onChange={(e) => setField("durationMinutes", e.target.value === "" ? null : Number(e.target.value))}
            size="small"
            inputProps={{ min: 1 }}
            className={styles.numField}
          />

          <TextField
            label="Objetivo"
            value={formData.objetivo}
            onChange={(e) => setField("objetivo", e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            className={`${styles.field} ${styles.fullWidthRow}`}
          />

          <TextField
            label="Objetivo por rol (opcional)"
            value={formData.objetivoPorRol ?? ""}
            onChange={(e) => setField("objetivoPorRol", e.target.value || null)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            className={`${styles.field} ${styles.fullWidthRow}`}
          />

          <Box className={styles.fullWidthRow}>
            <ModelRelationSection
              modelRelations={formData.modelRelations}
              onChange={(relations) => setField("modelRelations", relations)}
              teamId={teamId}
            />
          </Box>

          <Divider className={`${styles.divider} ${styles.fullWidthRow}`} />
          <Typography className={`${styles.skillsTitle} ${styles.fullWidthRow}`}>Niveles</Typography>
          <Box className={styles.fullWidthRow}>
            <NivelesEditor
              columnas={formData.nivelesColumnas}
              niveles={formData.niveles}
              onChange={(columnas, niveles) => {
                setField("nivelesColumnas", columnas);
                setField("niveles", niveles);
              }}
            />
          </Box>

          <Divider className={`${styles.divider} ${styles.fullWidthRow}`} />

          <TextField
            label="Logística"
            value={formData.logistica}
            onChange={(e) => setField("logistica", e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            placeholder="Tiempo · Material · Nº jugadores"
            className={`${styles.field} ${styles.fullWidthRow}`}
          />

          <TextField
            label="Porteros (opcional)"
            value={formData.porteros ?? ""}
            onChange={(e) => setField("porteros", e.target.value || null)}
            fullWidth
            size="small"
            className={styles.field}
          />

          <TextField
            label="Dibujo (opcional)"
            value={formData.dibujo ?? ""}
            onChange={(e) => setField("dibujo", e.target.value || null)}
            fullWidth
            size="small"
            placeholder="Referencia o (pendiente)"
            className={styles.field}
          />

          <Divider className={`${styles.divider} ${styles.fullWidthRow}`} />

          <TextField
            label="Descripción"
            value={formData.descripcion}
            onChange={(e) => setField("descripcion", e.target.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
            className={`${styles.field} ${styles.fullWidthRow}`}
          />

          <Divider className={`${styles.divider} ${styles.fullWidthRow}`} />
          <Typography className={`${styles.skillsTitle} ${styles.fullWidthRow}`}>Imagen / Video</Typography>
          <Box className={`${styles.mediaSection} ${styles.fullWidthRow}`}>
            {previewUrl && (
              <Box className={styles.mediaPreviewWrap}>
                {pendingFile?.type.startsWith("video/") ? (
                  <video src={previewUrl} controls className={styles.mediaPreview} />
                ) : (
                  <img src={previewUrl} alt="Vista previa" className={styles.mediaPreview} />
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
              className={styles.hiddenInput}
              onChange={handleFileChange}
              id="new-exercise-media-input"
            />
            <label htmlFor="new-exercise-media-input">
              <Button component="span" size="small" variant="outlined" className={styles.uploadBtn}>
                {previewUrl ? "Cambiar archivo" : "Subir imagen / video"}
              </Button>
            </label>
          </Box>

          {error && (
            <Typography color="error" className={`${styles.error} ${styles.fullWidthRow}`}>
              {error}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
