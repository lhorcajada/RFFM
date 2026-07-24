import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Chip, Collapse, IconButton, Tooltip,
  CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button, Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useLocation, useNavigate } from "react-router-dom";
import { client } from "../../../../../core/api/client";
import type { SubSubPrinciple } from "../../../types/gameModel";
import type { Exercise } from "../../../types/training";
import trainingService from "../../../services/trainingService";
import TacticalBoardSnapshotPreview, { tryParseBoardSnapshot } from "../../../components/TacticalBoardSnapshotPreview";
import styles from "./SubSubPrincipleCard.module.css";

const TYPE_LABELS: Record<string, string> = {
  Physical: "Físico",
  Technical: "Técnico",
  Tactical: "Táctico",
};

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");

function mediaUrl(urlImage: string) {
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

function isVideo(urlImage: string) {
  return /\.(mp4|webm|ogg)$/i.test(urlImage);
}

interface Props {
  index: number;
  subSubPrinciple: SubSubPrinciple;
  clubId: string;
}

export default function SubSubPrincipleCard({ index, subSubPrinciple, clubId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const teamId = params.get("teamId") ?? "";

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [exLoaded, setExLoaded] = useState(false);

  const [deleteExId, setDeleteExId] = useState<string | null>(null);
  const [deletingEx, setDeletingEx] = useState(false);

  const sspApiId = subSubPrinciple.apiId ?? "";

  const loadExercises = useCallback(() => {
    if (!clubId || !sspApiId) return;
    setLoadingEx(true);
    trainingService.getExercises(clubId, sspApiId)
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => { setLoadingEx(false); setExLoaded(true); });
  }, [clubId, sspApiId]);

  // Load exercises when first expanded
  useEffect(() => {
    if (expanded && !exLoaded) loadExercises();
  }, [expanded, exLoaded, loadExercises]);

  const totalExercises = exLoaded ? exercises.length : subSubPrinciple.essentialSkills.reduce(
    (sum, sk) => sum + (sk.exerciseCount ?? 0), 0
  );

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

  const goToExercisePage = (exerciseId?: string) => {
    if (!clubId || !sspApiId) return;

    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    createParams.set("subSubPrincipleId", sspApiId);
    createParams.set("sspName", subSubPrinciple.name);
    if (exerciseId) createParams.set("exerciseId", exerciseId);

    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `${location.pathname}${location.search}` },
    });
  };

  return (
    <Box className={styles.card}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <Box
        className={styles.header}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <Typography className={styles.title}>
          <span className={styles.index}>{index}.</span> {subSubPrinciple.name}
        </Typography>
        <Box className={styles.headerRight}>
          {subSubPrinciple.essentialSkills.length > 0 && (
            <Chip
              label={`${subSubPrinciple.essentialSkills.length} hab.`}
              size="small"
              className={styles.countChip}
            />
          )}
          {totalExercises > 0 && (
            <Chip
              icon={<FitnessCenterIcon style={{ fontSize: 12 }} />}
              label={`${totalExercises} ej.`}
              size="small"
              className={styles.exerciseChip}
            />
          )}
          <IconButton size="small" className={styles.expandBtn}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {/* ── Body ───────────────────────────────────────────────── */}
      <Collapse in={expanded} unmountOnExit>
        <Box className={styles.body}>
          <Typography className={styles.action}>{subSubPrinciple.action}</Typography>

          {/* Essential skills */}
          {subSubPrinciple.essentialSkills.length > 0 && (
            <Box className={styles.skills}>
              <Typography className={styles.skillsLabel}>
                Habilidades imprescindibles
              </Typography>
              <ul className={styles.skillList}>
                {subSubPrinciple.essentialSkills.map((skill) => (
                  <li key={skill.id} className={styles.skillItem}>
                    <Box className={styles.skillRow}>
                      <Chip
                        label={skill.name}
                        size="small"
                        className={`${styles.chip} ${skill.masteredAt ? styles.chipMastered : ""}`}
                      />
                      {skill.masteredAt && (
                        <Typography className={styles.masteredLabel}>✓ Dominada</Typography>
                      )}
                    </Box>
                    <Typography className={styles.skillDesc}>
                      {skill.description}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}

          {/* ── Exercises section ─────────────────────────────── */}
          {clubId && sspApiId && (
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
                          <Box className={`${styles.exMediaPlaceholder} ${styles[`exPlaceholder_${ex.type}`]}`}>
                            <Typography className={styles.exPlaceholderInitials}>
                              {ex.name.slice(0, 2).toUpperCase()}
                            </Typography>
                            <Typography className={styles.exPlaceholderType}>
                              {TYPE_LABELS[ex.type] ?? ex.type}
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

                        {/* Type chip */}
                        {ex.urlImage && (
                          <Box className={styles.exTypeRow}>
                            <Chip
                              label={TYPE_LABELS[ex.type] ?? ex.type}
                              size="small"
                              className={styles.typeChip}
                            />
                          </Box>
                        )}

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
                      )}                      </Box>
                    </Box>
                    );
                  })}
                </Box>
              )}
              </Box>
            </>
          )}
        </Box>
      </Collapse>

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
    </Box>
  );
}
