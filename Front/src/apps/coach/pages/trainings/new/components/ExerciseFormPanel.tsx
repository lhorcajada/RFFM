import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import { methodologyOptions, sectionOptions, typeOptions } from "../constants";
import type { ExerciseFormState, ExerciseMethodology } from "../hooks/useExerciseForm";
import styles from "../NewExercisePage.module.css";
import type { ExerciseSection, ExerciseType } from "../../../../types/training";
import seasonPlanService from "../../../../services/seasonPlanService";
import seasonService from "../../../../services/seasonService";

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

interface ExerciseFormPanelProps {
  panelVisible: boolean;
  form: ExerciseFormState;
  teamId?: string;
}

export default function ExerciseFormPanel({ panelVisible, form, teamId }: ExerciseFormPanelProps) {
  const microcicloOptions = useMicrocicloOptions(teamId);
  const {
    form: formData,
    setField,
    error,
    pendingFile,
    previewUrl,
    fileInputRef,
    conditions,
    conditionInput,
    setConditionInput,
    editingCondition,
    setEditingCondition,
    savingCondition,
    savedExerciseId,
    handleFileChange,
    handleRemoveMedia,
    handleAddCondition,
    handleSaveEditCondition,
    handleDeleteCondition,
    isPhysical,
    isTechTac,
  } = form;

  return (
    <Box className={`${styles.formPanel} ${panelVisible ? styles.formPanelVisible : ""}`}>
      <Box className={styles.panelHeader}>
        <Typography className={styles.panelTitle}>
          {form.savedExerciseId ? "Editar ejercicio" : "Nuevo ejercicio"}
        </Typography>
      </Box>

      <Box className={styles.panelBody}>
        <TextField
          label="Nombre"
          value={formData.name}
          onChange={(e) => setField("name", e.target.value)}
          fullWidth
          size="small"
          className={styles.field}
        />
        <TextField
          label="Descripcion"
          value={formData.description}
          onChange={(e) => setField("description", e.target.value)}
          fullWidth
          multiline
          minRows={2}
          size="small"
          className={styles.field}
        />

        <Box className={styles.row}>
          <FormControl size="small" className={styles.typeSelect}>
            <InputLabel id="exercise-type-label">Tipo</InputLabel>
            <Select
              multiple
              labelId="exercise-type-label"
              value={formData.types}
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
              {typeOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" className={styles.typeSelect}>
            <InputLabel>Seccion</InputLabel>
            <Select
              value={formData.section}
              label="Seccion"
              onChange={(e: SelectChangeEvent) =>
                setField("section", e.target.value as ExerciseSection)
              }
            >
              {sectionOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" className={styles.typeSelect}>
            <InputLabel>Metodologia</InputLabel>
            <Select
              value={formData.methodology}
              label="Metodologia"
              onChange={(e: SelectChangeEvent) =>
                setField("methodology", e.target.value as ExerciseMethodology)
              }
            >
              {methodologyOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Duracion total (min)"
            type="number"
            value={formData.durationTotal}
            onChange={(e) => setField("durationTotal", Number(e.target.value))}
            size="small"
            inputProps={{ min: 1 }}
            className={styles.numField}
          />
        </Box>

        <Box className={styles.row}>
          <TextField
            label="Jugadores"
            type="number"
            value={formData.playersNumber}
            onChange={(e) => setField("playersNumber", Number(e.target.value))}
            size="small"
            inputProps={{ min: 1 }}
            className={styles.numField}
          />
          <TextField
            label="Porteros"
            type="number"
            value={formData.goalPeekersNumber}
            onChange={(e) => setField("goalPeekersNumber", Number(e.target.value))}
            size="small"
            inputProps={{ min: 0 }}
            className={styles.numField}
          />
          <TextField
            label="Espacio"
            value={formData.fieldSpace}
            onChange={(e) => setField("fieldSpace", e.target.value)}
            size="small"
            placeholder="p. ej. 20x30m"
            className={styles.numField}
          />
        </Box>

        {isPhysical && (
          <Box className={styles.row}>
            <TextField
              label="Series"
              type="number"
              value={formData.series}
              onChange={(e) => setField("series", Number(e.target.value))}
              size="small"
              inputProps={{ min: 0 }}
              className={styles.numField}
            />
            <TextField
              label="Dur. serie (s)"
              type="number"
              value={formData.durationSeries}
              onChange={(e) => setField("durationSeries", Number(e.target.value))}
              size="small"
              inputProps={{ min: 0 }}
              className={styles.numField}
            />
            <TextField
              label="Descanso (s)"
              type="number"
              value={formData.restSeries}
              onChange={(e) => setField("restSeries", Number(e.target.value))}
              size="small"
              inputProps={{ min: 0 }}
              className={styles.numField}
            />
          </Box>
        )}

        {isTechTac && (
          <Box className={styles.row}>
            <TextField
              label="Toques"
              type="number"
              value={formData.touchesNumber}
              onChange={(e) => setField("touchesNumber", Number(e.target.value))}
              size="small"
              inputProps={{ min: 0 }}
              className={styles.numField}
            />
            <TextField
              label="Comodines"
              type="number"
              value={formData.wildCards}
              onChange={(e) => setField("wildCards", Number(e.target.value))}
              size="small"
              inputProps={{ min: 0 }}
              className={styles.numField}
            />
          </Box>
        )}

        {microcicloOptions.length > 0 && (
          <FormControl size="small" className={styles.field}>
            <InputLabel id="exercise-microciclo-label">Microciclo</InputLabel>
            <Select
              labelId="exercise-microciclo-label"
              label="Microciclo"
              value={formData.microcicloId ?? ""}
              displayEmpty
              onChange={(e: SelectChangeEvent) => setField("microcicloId", e.target.value || undefined)}
            >
              <MenuItem value="">Sin vincular</MenuItem>
              {microcicloOptions.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Divider className={styles.divider} />
        <Typography className={styles.skillsTitle}>Condiciones</Typography>
        {!savedExerciseId ? (
          <Typography className={styles.noSkills}>
            Guarda el ejercicio primero para poder anadir condiciones.
          </Typography>
        ) : (
          <Box className={styles.conditionsSection}>
            {conditions.map((c) => (
              <Box key={c.id} className={styles.conditionRow}>
                {editingCondition?.id === c.id ? (
                  <>
                    <TextField
                      value={editingCondition.text}
                      onChange={(e) =>
                        setEditingCondition((prev) =>
                          prev ? { ...prev, text: e.target.value } : null,
                        )
                      }
                      size="small"
                      fullWidth
                      autoFocus
                      className={styles.field}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEditCondition();
                        if (e.key === "Escape") setEditingCondition(null);
                      }}
                    />
                    <IconButton
                      size="small"
                      className={styles.conditionSaveBtn}
                      onClick={handleSaveEditCondition}
                      disabled={savingCondition}
                    >
                      ✓
                    </IconButton>
                    <IconButton
                      size="small"
                      className={styles.conditionCancelBtn}
                      onClick={() => setEditingCondition(null)}
                    >
                      ✕
                    </IconButton>
                  </>
                ) : (
                  <>
                    <Typography className={styles.conditionText}>
                      <span className={styles.conditionBullet}>•</span> {c.text}
                    </Typography>
                    <Box className={styles.conditionActions}>
                      <IconButton
                        size="small"
                        className={styles.conditionEditBtn}
                        onClick={() => setEditingCondition({ id: c.id, text: c.text })}
                      >
                        Ed
                      </IconButton>
                      <IconButton
                        size="small"
                        className={styles.conditionDeleteBtn}
                        onClick={() => handleDeleteCondition(c.id)}
                        disabled={savingCondition}
                      >
                        Del
                      </IconButton>
                    </Box>
                  </>
                )}
              </Box>
            ))}

            <Box className={styles.conditionAddRow}>
              <TextField
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                size="small"
                placeholder="Nueva condicion..."
                fullWidth
                className={styles.field}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCondition();
                }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={handleAddCondition}
                disabled={!conditionInput.trim() || savingCondition}
                className={styles.uploadBtn}
              >
                Anadir
              </Button>
            </Box>
          </Box>
        )}

        <Divider className={styles.divider} />
        <Typography className={styles.skillsTitle}>Imagen / Video</Typography>
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

        {error && (
          <Typography color="error" className={styles.error}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
