import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Chip, IconButton, Tooltip,
  CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button, Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useLocation, useNavigate } from "react-router-dom";
import { client } from "../../../../../core/api/client";
import type { Exercise } from "../../../types/training";
import trainingService from "../../../services/trainingService";
import TacticalBoardSnapshotPreview, { tryParseBoardSnapshot } from "../../../components/TacticalBoardSnapshotPreview";
// Reuses SubSubPrincipleCard's CSS module: this section was extracted from that
// component, and SubSubPrincipleCard.test.tsx already asserts against these
// scoped class names, so importing the same module file keeps both in sync.
import styles from "./SubSubPrincipleCard.module.css";
import { TYPE_LABELS, SECTION_LABELS } from "../../trainings/exerciseTypeLabels";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

function mediaUrl(urlImage: string) {
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

function isVideo(urlImage: string) {
  return /\.(mp4|webm|ogg)$/i.test(urlImage);
}

export type PrincipleLevelKind = "subSubPrinciple" | "subPrinciple" | "scenario";

interface Props {
  clubId: string;
  teamId: string;
  levelKind: PrincipleLevelKind;
  levelApiId: string;
  levelName: string;
  active: boolean;
  onCountChange?: (count: number) => void;
  /** Only relevant when levelKind is "subSubPrinciple": lets the create/edit
   * form offer reassignment to the parent subprincipio. */
  parentSubPrincipleApiId?: string | null;
  parentSubPrincipleName?: string | null;
  /** Only relevant when levelKind is "subPrinciple": lets the create/edit
   * form offer reassignment to the parent scenario. */
  parentScenarioApiId?: string | null;
  parentScenarioName?: string | null;
}

export default function PrincipleExercisesSection({
  clubId,
  teamId,
  levelKind,
  levelApiId,
  levelName,
  active,
  onCountChange,
  parentSubPrincipleApiId,
  parentSubPrincipleName,
  parentScenarioApiId,
  parentScenarioName,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [exLoaded, setExLoaded] = useState(false);

  const [deleteExId, setDeleteExId] = useState<string | null>(null);
  const [deletingEx, setDeletingEx] = useState(false);

  const loadExercises = useCallback(() => {
    if (!clubId || !levelApiId) return;
    setLoadingEx(true);
    const opts =
      levelKind === "subSubPrinciple"
        ? { subSubPrincipleId: levelApiId }
        : levelKind === "subPrinciple"
        ? { subPrincipleId: levelApiId }
        : { scenarioId: levelApiId };
    trainingService
      .getExercises(clubId, opts)
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => { setLoadingEx(false); setExLoaded(true); });
  }, [clubId, levelApiId, levelKind]);

  // Load exercises the first time the section becomes active
  useEffect(() => {
    if (active && !exLoaded) loadExercises();
  }, [active, exLoaded, loadExercises]);

  useEffect(() => {
    if (exLoaded) onCountChange?.(exercises.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exLoaded, exercises.length]);

  const handleDelete = async () => {
    if (!deleteExId) return;
    setDeletingEx(true);
    try {
      await trainingService.deleteExercise(deleteExId);
      setDeleteExId(null);
      loadExercises();
    } finally {
      setDeletingEx(false);
    }
  };

  const buildExerciseParams = () => {
    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    if (levelKind === "subSubPrinciple") {
      createParams.set("subSubPrincipleId", levelApiId);
      createParams.set("sspName", levelName);
      if (parentSubPrincipleApiId) {
        createParams.set("subPrincipleId", parentSubPrincipleApiId);
        createParams.set("spName", parentSubPrincipleName ?? "");
      }
    } else if (levelKind === "subPrinciple") {
      createParams.set("subPrincipleId", levelApiId);
      createParams.set("spName", levelName);
      if (parentScenarioApiId) {
        createParams.set("scenarioId", parentScenarioApiId);
        createParams.set("scenarioName", parentScenarioName ?? "");
      }
    } else {
      createParams.set("scenarioId", levelApiId);
      createParams.set("scenarioName", levelName);
    }
    return createParams;
  };

  const navigateToExerciseForm = (createParams: URLSearchParams) => {
    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `${location.pathname}${location.search}` },
    });
  };

  const goToExercisePage = (exerciseId?: string) => {
    if (!clubId || !levelApiId) return;

    const createParams = buildExerciseParams();
    if (exerciseId) createParams.set("exerciseId", exerciseId);
    navigateToExerciseForm(createParams);
  };

  const duplicateExercise = (exerciseId: string) => {
    if (!clubId || !levelApiId) return;

    const createParams = buildExerciseParams();
    createParams.set("duplicateFrom", exerciseId);
    navigateToExerciseForm(createParams);
  };

  if (!active) return null;

  return (
    <>
      <Divider className={styles.divider} />
      <Box className={styles.exercisesSection}>
        <Box className={styles.exercisesHeader}>
          <Typography className={styles.exercisesLabel}>
            Ejercicios de entrenamiento
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            variant="outlined"
            className={styles.addExBtn}
            onClick={(e) => {
              e.stopPropagation();
              goToExercisePage();
            }}
          >
            Añadir ejercicio
          </Button>
        </Box>

        {loadingEx ? (
          <Box className={styles.exLoading}>
            <CircularProgress size={18} />
          </Box>
        ) : exercises.length === 0 ? (
          <Typography className={styles.exEmpty}>
            Sin ejercicios. Pulsa + para añadir uno.
          </Typography>
        ) : (
          <Box className={styles.exGrid}>
            {exercises.map((ex) => {
              const boardSnapshot = tryParseBoardSnapshot(ex.boardStateJson);
              return (
                <Box key={ex.id} className={styles.exCard}>
                  {/* ── Media / Placeholder ── */}
                  <Box className={styles.exCardMedia}>
                    {ex.urlImage ? (
                      isVideo(ex.urlImage) ? (
                        <video
                          src={mediaUrl(ex.urlImage)}
                          controls
                          className={styles.exMediaEl}
                        />
                      ) : (
                        <img
                          src={mediaUrl(ex.urlImage)}
                          alt={ex.name}
                          className={styles.exMediaEl}
                        />
                      )
                    ) : boardSnapshot ? (
                      <TacticalBoardSnapshotPreview snapshot={boardSnapshot} teamId={teamId} />
                    ) : (
                      <Box className={`${styles.exMediaPlaceholder} ${styles[`exPlaceholder_${ex.types[0]}`]}`}>
                        <Typography className={styles.exPlaceholderInitials}>
                          {ex.name.slice(0, 2).toUpperCase()}
                        </Typography>
                        <Typography className={styles.exPlaceholderType}>
                          {TYPE_LABELS[ex.types[0]] ?? ex.types[0]}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* ── Card body ── */}
                  <Box className={styles.exCardBody}>
                    {/* Name + actions */}
                    <Box className={styles.exCardTop}>
                      <Typography className={styles.exName}>{ex.name}</Typography>
                      <Box className={styles.exActions}>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            className={styles.exEditBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              goToExercisePage(ex.id);
                            }}
                          >
                            <EditIcon style={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicar">
                          <IconButton
                            size="small"
                            className={styles.exDuplicateBtn}
                            aria-label="Duplicar"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateExercise(ex.id);
                            }}
                          >
                            <ContentCopyIcon style={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            className={styles.exDeleteBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteExId(ex.id);
                            }}
                          >
                            <DeleteOutlineIcon style={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Type + section chips */}
                    <Box className={styles.exTypeRow}>
                      {ex.types.map((t) => (
                        <Chip
                          key={t}
                          label={TYPE_LABELS[t] ?? t}
                          size="small"
                          className={styles.typeChip}
                        />
                      ))}
                      <Chip
                        label={SECTION_LABELS[ex.section] ?? ex.section}
                        size="small"
                        className={styles.sectionChip}
                      />
                    </Box>

                    {/* Stats */}
                    <Box className={styles.exStats}>
                      <Typography className={styles.exStatItem}>
                        <span className={styles.exStatIcon}>⏱</span>{ex.durationTotal} min
                      </Typography>
                      <Typography className={styles.exStatItem}>
                        <span className={styles.exStatIcon}>👥</span>{ex.playersNumber}
                        {ex.goalPeekersNumber > 0 ? ` + ${ex.goalPeekersNumber}P` : ""}
                      </Typography>
                      {ex.fieldSpace && (
                        <Typography className={styles.exStatItem}>
                          <span className={styles.exStatIcon}>📐</span>{ex.fieldSpace}
                        </Typography>
                      )}
                    </Box>

                    {/* Description */}
                    {ex.description && (
                      <Typography className={styles.exDescription}>
                        {ex.description}
                      </Typography>
                    )}

                    {/* Skill tags */}
                    {ex.skills.length > 0 && (
                      <Box className={styles.exSkills}>
                        {ex.skills.map((sk) => (
                          <Chip
                            key={sk.essentialSkillId}
                            label={sk.skillName}
                            size="small"
                            className={styles.skillTagChip}
                          />
                        ))}
                      </Box>
                    )}
                    {/* Conditions */}
                    {(ex.conditions ?? []).length > 0 && (
                      <Box className={styles.exConditions}>
                        <Typography className={styles.exConditionsLabel}>Condiciones</Typography>
                        <ul className={styles.exConditionsList}>
                          {(ex.conditions ?? []).map(c => (
                            <li key={c.id} className={styles.exConditionItem}>{c.text}</li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Delete confirmation ───────────────────────────────── */}
      <Dialog
        open={!!deleteExId}
        onClose={() => setDeleteExId(null)}
        PaperProps={{ sx: { bgcolor: "#07071a", border: "1px solid rgba(77,157,224,.25)" } }}
      >
        <DialogTitle sx={{ color: "#4d9de0", fontSize: "0.95rem" }}>
          Eliminar ejercicio
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "#e8e8e8", fontSize: "0.85rem" }}>
            ¿Seguro que quieres eliminar este ejercicio?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteExId(null)}
            sx={{ color: "rgba(212, 212, 212, .6)", fontSize: "0.8rem" }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deletingEx}
            variant="contained"
            sx={{ bgcolor: "#c0392b", "&:hover": { bgcolor: "#e74c3c" }, fontSize: "0.8rem" }}
          >
            {deletingEx ? <CircularProgress size={14} /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
