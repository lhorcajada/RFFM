import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { sectionOptions, typeOptions } from "../constants";
import type { ExerciseFormState } from "../hooks/useExerciseForm";
import styles from "../NewExercisePage.module.css";
import type { ExerciseSection, ExerciseType } from "../../../../types/training";

interface ExerciseFormPanelProps {
  panelVisible: boolean;
  subSubPrincipleId: string | null;
  subSubPrincipleName: string | null;
  subPrincipleId: string | null;
  subPrincipleName: string | null;
  scenarioId: string | null;
  scenarioName: string | null;
  /** When the current subprincipio has more than one sub-subprincipio, lists
   * them all so the coach can pick which one to reassign the exercise to
   * (instead of the single, ambiguous `subSubPrincipleId` context id). */
  subSubPrincipleOptions?: { apiId: string; name: string }[];
  form: ExerciseFormState;
}

export default function ExerciseFormPanel({
  panelVisible,
  subSubPrincipleId,
  subSubPrincipleName,
  subPrincipleId,
  subPrincipleName,
  scenarioId,
  scenarioName,
  subSubPrincipleOptions = [],
  form,
}: ExerciseFormPanelProps) {
  const {
    form: formData,
    setField,
    setLevel,
    toggleSkill,
    skills,
    loadingSkills,
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
        {subSubPrincipleName && (
          <Typography className={styles.panelSubtitle}>{subSubPrincipleName}</Typography>
        )}
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

        {(() => {
          const sspOptions =
            subSubPrincipleOptions.length > 0
              ? subSubPrincipleOptions
              : subSubPrincipleId
              ? [{ apiId: subSubPrincipleId, name: subSubPrincipleName ?? "" }]
              : [];

          if ((Number(!!scenarioId) + Number(!!subPrincipleId) + Number(sspOptions.length > 0)) < 2) return null;

          return (
            <FormControl size="small" className={styles.field}>
              <InputLabel id="exercise-level-label">Vinculado a</InputLabel>
              <Select
                labelId="exercise-level-label"
                value={
                  formData.scenarioId
                    ? "scenario"
                    : formData.subPrincipleId
                    ? "subPrinciple"
                    : formData.subSubPrincipleId
                    ? `ssp:${formData.subSubPrincipleId}`
                    : ""
                }
                label="Vinculado a"
                onChange={(e: SelectChangeEvent) => {
                  const value = e.target.value;
                  if (value.startsWith("ssp:")) {
                    setLevel("subSubPrinciple", value.slice(4));
                  } else {
                    setLevel(value as "subPrinciple" | "scenario");
                  }
                }}
              >
                {scenarioId && <MenuItem value="scenario">Escenario: {scenarioName}</MenuItem>}
                {subPrincipleId && <MenuItem value="subPrinciple">Subprincipio: {subPrincipleName}</MenuItem>}
                {sspOptions.map((opt) => (
                  <MenuItem key={opt.apiId} value={`ssp:${opt.apiId}`}>
                    Habilidad: {opt.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        })()}

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

        {formData.subSubPrincipleId && (
          <>
            <Divider className={styles.divider} />
            <Typography className={styles.skillsTitle}>Habilidades asociadas</Typography>
            {loadingSkills ? (
              <CircularProgress size={20} />
            ) : skills.length === 0 ? (
              <Typography className={styles.noSkills}>
                Sin habilidades definidas para este sub-subprincipio.
              </Typography>
            ) : (
              <FormGroup>
                {skills.map((sk) => (
                  <FormControlLabel
                    key={sk.id}
                    control={
                      <Checkbox
                        checked={formData.essentialSkillIds.includes(sk.id)}
                        onChange={() => toggleSkill(sk.id)}
                        size="small"
                        className={styles.checkbox}
                      />
                    }
                    label={
                      <Box>
                        <Typography className={styles.skillName}>{sk.name}</Typography>
                        {sk.description && (
                          <Typography className={styles.skillDesc}>{sk.description}</Typography>
                        )}
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            )}
          </>
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
