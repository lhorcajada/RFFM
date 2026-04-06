import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { useNavigate, useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { client } from "../../../../core/api/client";
import trainingService from "../../services/trainingService";
import type { TrainingSession, SessionExerciseItem } from "../../types/training";
import type { TacticalPrinciple } from "../../types/gameModel";
import styles from "./SessionsFromSubPrinciple.module.css";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");
function mediaUrl(urlImage: string) { return `${API_BASE}/api/local-storage/${urlImage}`; }
function isVideo(u: string) { return /\.(mp4|webm|ogg)$/i.test(u); }

interface SubPrincipleInfo {
  id: number;
  apiId: string | null;
  label: string;
  name: string;
  tacticalPrinciples: TacticalPrinciple[];
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
  teamId: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(t: string) {
  return t ? t.slice(0, 5) : "";
}

const TYPE_LABELS: Record<string, string> = {
  Physical: "Físico",
  Technical: "Técnico",
  Tactical: "Táctico",
};

const SECTION_LABELS: Record<string, string> = {
  Calentamiento: "Calentamiento",
  Principal: "Principal",
  VueltaALaCalma: "Vuelta a la Calma",
};

function SessionCard({ sess }: { sess: TrainingSession }) {
  const [expanded, setExpanded] = useState(false);
  const [exercises, setExercises] = useState<SessionExerciseItem[] | null>(null);
  const [loadingEx, setLoadingEx] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => {
      if (!prev && exercises === null) {
        setLoadingEx(true);
        trainingService
          .getSessionById(sess.id)
          .then((detail) => setExercises(detail.exercises.slice().sort((a, b) => a.order - b.order)))
          .catch(() => setExercises([]))
          .finally(() => setLoadingEx(false));
      }
      return !prev;
    });
  }, [sess.id, exercises]);

  return (
    <Box className={styles.sessionCard}>
      <Box className={styles.sessionHeader} onClick={handleToggle}>
        <Box className={styles.sessionInfo}>
          <Typography className={styles.sessionName}>{sess.name}</Typography>
          <Typography className={styles.sessionDate}>{formatDate(sess.date)}</Typography>
          <Box className={styles.sessionMeta}>
            <Typography className={styles.sessionMetaText}>
              {formatTime(sess.startTime)}
              {sess.endTime ? ` – ${formatTime(sess.endTime)}` : ""}
              {sess.location ? ` · ${sess.location}` : ""}
            </Typography>
            <Chip
              label={`${sess.exerciseCount} ejercicio${sess.exerciseCount !== 1 ? "s" : ""}`}
              size="small"
              className={styles.countChip}
            />
          </Box>
        </Box>
        <IconButton size="small" className={styles.expandBtn}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box className={styles.exerciseList}>
          {loadingEx ? (
            <Box className={styles.exLoadingBox}>
              <CircularProgress size={20} />
            </Box>
          ) : exercises && exercises.length === 0 ? (
            <Typography className={styles.exEmptyText}>Sin ejercicios.</Typography>
          ) : exercises ? (
            (["Calentamiento", "Principal", "VueltaALaCalma"] as const).map(secKey => {
              const secExercises = exercises.filter(e => e.section === secKey);
              if (secExercises.length === 0) return null;
              const secLabel: Record<string, string> = {
                Calentamiento: "Calentamiento",
                Principal: "Ejercicios principales",
                VueltaALaCalma: "Vuelta a la Calma",
              }[secKey] as unknown as Record<string, string>;
              return (
                <Box key={secKey} className={styles.sectionGroup}>
                  <Typography className={`${styles.sectionGroupTitle} ${styles[`sectionTitle_${secKey}`]}`}>
                    {secLabel as unknown as string}
                  </Typography>
                  <Box className={styles.exGrid}>
                    {secExercises.map((ex, idx) => (
                      <Box key={ex.taskTrainingId} className={styles.exCard}>
                        {/* ── Media ── */}
                        {ex.urlImage ? (
                          <Box className={styles.exMediaWrap}>
                            {isVideo(ex.urlImage) ? (
                              <video src={mediaUrl(ex.urlImage)} controls className={styles.exMediaEl} />
                            ) : (
                              <img src={mediaUrl(ex.urlImage)} alt={ex.name} className={styles.exMediaEl} />
                            )}
                            <Chip
                              label={TYPE_LABELS[ex.type] ?? ex.type}
                              size="small"
                              className={`${styles.exTypeBadge} ${styles[`badge_${ex.type}`]}`}
                            />
                            <span className={styles.exOrderBadge}>{idx + 1}</span>
                          </Box>
                        ) : (
                          <Box className={`${styles.exPlaceholder} ${styles[`exPlaceholder_${ex.type}`]}`}>
                            <FitnessCenterIcon className={styles.exPlaceholderIcon} />
                            <Typography className={styles.exPlaceholderType}>
                              {TYPE_LABELS[ex.type] ?? ex.type}
                            </Typography>
                            <Chip
                              label={TYPE_LABELS[ex.type] ?? ex.type}
                              size="small"
                              className={`${styles.exTypeBadge} ${styles[`badge_${ex.type}`]}`}
                            />
                            <span className={styles.exOrderBadge}>{idx + 1}</span>
                          </Box>
                        )}

                        {/* ── Body ── */}
                        <Box className={styles.exBody}>
                          <Typography className={styles.exName}>{ex.name}</Typography>

                          <Box className={styles.exStats}>
                            <Typography className={styles.exStatItem}>⏱ {ex.durationTotal} min</Typography>
                            <Typography className={styles.exStatItem}>
                              👥 {ex.playersNumber}{ex.goalPeekersNumber > 0 ? ` + ${ex.goalPeekersNumber}P` : ""}
                            </Typography>
                            {ex.fieldSpace && (
                              <Typography className={styles.exStatItem}>📐 {ex.fieldSpace}</Typography>
                            )}
                          </Box>

                          {ex.description && (
                            <Typography className={styles.exDescription}>{ex.description}</Typography>
                          )}

                          {(ex.skills ?? []).length > 0 && (
                            <Box className={styles.exSkillRow}>
                              {(ex.skills ?? []).map((sk) => (
                                <Chip key={sk.essentialSkillId} label={sk.skillName} size="small" className={styles.skillChip} />
                              ))}
                            </Box>
                          )}

                          {(ex.conditions ?? []).length > 0 && (
                            <Box className={styles.exConditions}>
                              <Typography className={styles.exConditionsLabel}>Condiciones</Typography>
                              <ul className={styles.exConditionsList}>
                                {(ex.conditions ?? []).map((c) => (
                                  <li key={c.id} className={styles.exConditionItem}>{c.text}</li>
                                ))}
                              </ul>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })
          ) : null}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function SessionsFromSubPrinciple() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PageState | null;

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state?.teamId) return;
    setLoading(true);
    trainingService
      .getSessions(state.teamId, state.subPrinciple?.apiId ?? undefined)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [state?.teamId, state?.subPrinciple?.apiId]);

  if (!state) {
    return (
      <BaseLayout hideFooterMenu>
        <ContentLayout
          title="Sesiones"
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

  const { gameMomentName, zoneName, scenario, subPrinciple } = state;

  const handleNewSession = () => {
    navigate(`/coach/game-model/create-session${location.search}`, {
      state: {
        gameMomentName,
        zoneName,
        scenario,
        subPrinciple: {
          ...subPrinciple,
          context: "",
          subSubPrincipleApiIds: [],
        },
        clubId: new URLSearchParams(location.search).get("clubId") ?? "",
        teamId: state.teamId,
      },
    });
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Sesiones de Entrenamiento"
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
            {subPrinciple.tacticalPrinciples.length > 0 && (
              <Box className={styles.principlesRow}>
                <Typography className={styles.principlesLabel}>
                  Principios tácticos:
                </Typography>
                {subPrinciple.tacticalPrinciples.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    size="small"
                    className={styles.principleChip}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* ── Toolbar ──────────────────────────────────── */}
          <Box className={styles.toolbarRow}>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              className={styles.addBtn}
              onClick={handleNewSession}
            >
              Nueva sesión
            </Button>
          </Box>

          {/* ── Session list ──────────────────────────────── */}
          {loading ? (
            <Box className={styles.loadingBox}>
              <CircularProgress size={32} />
            </Box>
          ) : sessions.length === 0 ? (
            <Typography className={styles.emptyText}>
              No hay sesiones registradas para este subprincipio.
            </Typography>
          ) : (
            sessions.map((sess) => <SessionCard key={sess.id} sess={sess} />)
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
