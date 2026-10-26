import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { subtipoOptions, tipoOptions } from "../constants";
import type { ExerciseFormState } from "../hooks/useExerciseForm";
import styles from "../NewExercisePage.module.css";
import type { ExerciseSubtipo, ExerciseTipo } from "../../../../types/training";
import ModelRelationSection from "./ModelRelationSection";

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
        <Box className={styles.sectionCard} component="section">
          <Typography component="h2" className={styles.sectionTitle}>Clasificación</Typography>
          <Box role="group" aria-labelledby="exercise-tipo-label" className={styles.tipoGroup}>
            <Typography id="exercise-tipo-label" className={styles.tipoLabel}>Tipo</Typography>
            <Box className={styles.tipoButtons}>
              {tipoOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={formData.tipo === o.value}
                  className={`${styles.tipoBtn} ${formData.tipo === o.value ? styles.tipoBtnActive : ""}`}
                  onClick={() => setField("tipo", o.value as ExerciseTipo)}
                >
                  {o.label}
                </button>
              ))}
            </Box>
          </Box>

          <Box className={styles.twoCols}>
          <FormControl size="small" className={styles.typeSelect}>
            <InputLabel id="exercise-subtipo-label" shrink>Subtipo</InputLabel>
            <Select
              labelId="exercise-subtipo-label"
              label="Subtipo"
              notched
              displayEmpty
              value={formData.subtipo ?? ""}
              onChange={(e: SelectChangeEvent) =>
                setField("subtipo", e.target.value === "" ? null : (e.target.value as ExerciseSubtipo))
              }
            >
              <MenuItem value="">Sin subtipo</MenuItem>
              {subtipoOptions.map((o) => (
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
          </Box>
        </Box>

        <Box className={styles.sectionCard} component="section">
          <Typography component="h2" className={styles.sectionTitle}>Objetivos</Typography>
          <TextField
            label="Objetivo"
            value={formData.objetivo}
            onChange={(e) => setField("objetivo", e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            className={styles.field}
          />
          <TextField
            label="Objetivo por rol (opcional)"
            value={formData.objetivoPorRol ?? ""}
            onChange={(e) => setField("objetivoPorRol", e.target.value || null)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            className={styles.field}
          />
        </Box>

        <Box className={styles.sectionCard} component="section">
          <Typography component="h2" className={styles.sectionTitle}>Modelo de juego</Typography>
          <ModelRelationSection
            modelRelations={formData.modelRelations}
            onChange={(relations) => setField("modelRelations", relations)}
            teamId={teamId}
          />
        </Box>

        <Box className={styles.sectionCard} component="section">
          <Typography component="h2" className={styles.sectionTitle}>Organización</Typography>
          <TextField
            label="Logística"
            value={formData.logistica}
            onChange={(e) => setField("logistica", e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            placeholder="Tiempo · Material · Nº jugadores"
            className={styles.field}
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
            label="Descripción"
            value={formData.descripcion}
            onChange={(e) => setField("descripcion", e.target.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
            className={styles.field}
          />
        </Box>

        <Box className={styles.sectionCard} component="section">
          <Typography component="h2" className={styles.sectionTitle}>Imagen / vídeo</Typography>
          <Box className={styles.mediaSection}>
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

        </Box>

        {error && (
          <Typography color="error" className={styles.error}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
