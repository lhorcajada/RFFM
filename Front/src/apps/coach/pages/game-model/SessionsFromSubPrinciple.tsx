import { useEffect, useState, useCallback } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import PrintIcon from "@mui/icons-material/Print";
import ExerciseDialog from "../trainings/components/ExerciseDialog";
import { useNavigate, useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { client } from "../../../../core/api/client";
import trainingService from "../../services/trainingService";
import type { TrainingSession, SessionExerciseItem, Exercise, ExerciseSection } from "../../types/training";
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
  clubId: string;
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

const SECTION_OPTIONS: { value: ExerciseSection; label: string }[] = [
  { value: "Calentamiento",  label: "Calentamiento" },
  { value: "Principal",      label: "Principal" },
  { value: "VueltaALaCalma", label: "Vuelta a la Calma" },
];

function sessionItemToExercise(item: SessionExerciseItem): Exercise {
  return {
    id: item.exerciseId,
    name: item.name,
    description: item.description,
    type: item.type,
    section: item.section,
    durationTotal: item.durationTotal,
    playersNumber: item.playersNumber,
    goalPeekersNumber: item.goalPeekersNumber,
    fieldSpace: item.fieldSpace,
    urlImage: item.urlImage ?? null,
    skills: item.skills,
    conditions: item.conditions,
    subSubPrincipleId: null,
    subSubPrincipleName: null,
  };
}

function buildUpdateReq(sess: TrainingSession, exList: SessionExerciseItem[]) {
  return {
    name: sess.name,
    description: sess.description,
    date: sess.date,
    startTime: sess.startTime,
    endTime: sess.endTime ?? null,
    location: sess.location ?? null,
    sportEventId: sess.sportEventId ?? null,
    subPrincipleId: sess.subPrincipleId ?? null,
    exercises: exList.map(e => ({ exerciseId: e.exerciseId, section: e.section })),
  };
}

function ExerciseModal({ ex, onClose }: { ex: SessionExerciseItem | null; onClose: () => void }) {
  return (
    <Dialog
      open={ex !== null}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      classes={{ paper: styles.modalPaper }}
      TransitionProps={{ timeout: 280 }}
    >
      {ex && (
        <DialogContent className={styles.modalContent}>
          <IconButton className={styles.modalCloseBtn} onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>

          {/* Media */}
          {ex.urlImage ? (
            <Box className={styles.modalMediaWrap}>
              {isVideo(ex.urlImage) ? (
                <video src={mediaUrl(ex.urlImage)} controls className={styles.modalMediaEl} />
              ) : (
                <img src={mediaUrl(ex.urlImage)} alt={ex.name} className={styles.modalMediaEl} />
              )}
            </Box>
          ) : (
            <Box className={`${styles.modalPlaceholder} ${styles[`exPlaceholder_${ex.type}`]}`}>
              <FitnessCenterIcon className={styles.modalPlaceholderIcon} />
            </Box>
          )}

          {/* Header */}
          <Box className={styles.modalHeader}>
            <Chip
              label={TYPE_LABELS[ex.type] ?? ex.type}
              size="small"
              className={`${styles.exTypeBadge} ${styles[`badge_${ex.type}`]}`}
              sx={{ position: "static" }}
            />
            <Typography className={styles.modalName}>{ex.name}</Typography>
          </Box>

          {/* Stats */}
          <Box className={styles.modalStats}>
            <Box className={styles.modalStatItem}>
              <Typography className={styles.modalStatLabel}>Duración</Typography>
              <Typography className={styles.modalStatValue}>⏱ {ex.durationTotal} min</Typography>
            </Box>
            <Box className={styles.modalStatItem}>
              <Typography className={styles.modalStatLabel}>Jugadores</Typography>
              <Typography className={styles.modalStatValue}>
                👥 {ex.playersNumber}{ex.goalPeekersNumber > 0 ? ` + ${ex.goalPeekersNumber}P` : ""}
              </Typography>
            </Box>
            {ex.fieldSpace && (
              <Box className={styles.modalStatItem}>
                <Typography className={styles.modalStatLabel}>Espacio</Typography>
                <Typography className={styles.modalStatValue}>📐 {ex.fieldSpace}</Typography>
              </Box>
            )}
          </Box>

          {/* Description */}
          {ex.description && (
            <Typography className={styles.modalDescription}>{ex.description}</Typography>
          )}

          {/* Skills */}
          {(ex.skills ?? []).length > 0 && (
            <Box className={styles.exSkillRow} sx={{ mt: 1.5, px: "20px" }}>
              {(ex.skills ?? []).map((sk) => (
                <Chip key={sk.essentialSkillId} label={sk.skillName} size="small" className={styles.skillChip} />
              ))}
            </Box>
          )}

          {/* Conditions */}
          {(ex.conditions ?? []).length > 0 && (
            <Box className={styles.exConditions} sx={{ mt: 1.5, px: "20px", pb: 2 }}>
              <Typography className={styles.exConditionsLabel}>Condiciones</Typography>
              <ul className={styles.exConditionsList}>
                {(ex.conditions ?? []).map((c) => (
                  <li key={c.id} className={styles.exConditionItem}>{c.text}</li>
                ))}
              </ul>
            </Box>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

interface PrintContext {
  gameMomentName: string;
  zoneName: string;
  scenarioName: string;
  scenarioOrder: number;
  subPrincipleLabel: string;
  subPrincipleName: string;
  tacticalPrinciples: TacticalPrinciple[];
}

function buildPrintHtml(sess: TrainingSession, exercises: SessionExerciseItem[], ctx: PrintContext) {
  const sections: { key: string; label: string; color: string }[] = [
    { key: "Calentamiento",   label: "Calentamiento",        color: "#e67e22" },
    { key: "Principal",       label: "Ejercicios principales", color: "#27ae60" },
    { key: "VueltaALaCalma",  label: "Vuelta a la Calma",    color: "#2980b9" },
  ];

  const typeLabel: Record<string, string> = { Physical: "Físico", Technical: "Técnico", Tactical: "Táctico" };
  const typeColor: Record<string, string> = { Physical: "#c0392b", Technical: "#2980b9", Tactical: "#27ae60" };

  const sectionHtml = sections.map(({ key, label, color }) => {
    const exs = exercises.filter(e => e.section === key);
    const exHtml = exs.length === 0
      ? `<p style="color:#aaa;font-style:italic;margin:6px 0 0">Sin ejercicios en esta sección</p>`
      : exs.map((ex, idx) => `
          <div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;width:380px;flex-shrink:0;background:#fff;page-break-inside:avoid;">
            ${ex.urlImage
              ? (isVideo(ex.urlImage)
                  ? `<div style="width:100%;aspect-ratio:4/3;background:#eee;display:flex;align-items:center;justify-content:center;font-size:12px;color:#888">📹 vídeo</div>`
                  : `<img src="${mediaUrl(ex.urlImage)}" alt="${ex.name}" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;" />`)
              : `<div style="width:100%;aspect-ratio:4/3;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:28px;">⚽</div>`
            }
            <div style="padding:8px 10px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="background:${typeColor[ex.type] ?? "#555"};color:#fff;font-size:10px;font-weight:700;border-radius:3px;padding:1px 6px;">${typeLabel[ex.type] ?? ex.type}</span>
                <span style="font-size:10px;color:#888;">#${idx + 1}</span>
              </div>
              <div style="font-size:13px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${ex.name}</div>
              <div style="font-size:11px;color:#555;display:flex;gap:8px;flex-wrap:wrap;">
                <span>⏱ ${ex.durationTotal} min</span>
                <span>👥 ${ex.playersNumber}${ex.goalPeekersNumber > 0 ? ` + ${ex.goalPeekersNumber}P` : ""}</span>
                ${ex.fieldSpace ? `<span>📐 ${ex.fieldSpace}</span>` : ""}
              </div>
              ${ex.description ? `<p style="font-size:11px;color:#666;font-style:italic;margin:5px 0 0">${ex.description}</p>` : ""}
              ${(ex.conditions ?? []).length > 0
                ? `<ul style="font-size:11px;color:#555;margin:5px 0 0;padding-left:14px;">${(ex.conditions ?? []).map(c => `<li>${c.text}</li>`).join("")}</ul>`
                : ""}
            </div>
          </div>`).join("");

    return `
      <div style="margin-bottom:24px;page-break-inside:avoid;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:${color};border-bottom:2px solid ${color};padding-bottom:4px;margin-bottom:12px;">${label}</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;">${exHtml}</div>
      </div>`;
  }).join("");

  const meta = [
    formatDate(sess.date),
    sess.startTime ? `${formatTime(sess.startTime)}${sess.endTime ? ` – ${formatTime(sess.endTime)}` : ""}` : null,
    sess.location ?? null,
  ].filter(Boolean).join(" · ");

  const principlesHtml = ctx.tacticalPrinciples.length > 0
    ? `<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">${ctx.tacticalPrinciples.map(p =>
        `<span style="background:#eaf4fb;color:#1a6fa3;border:1px solid #b3d9f0;border-radius:4px;font-size:10px;padding:2px 7px;display:inline-block;">${p.name}</span>`
      ).join("")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${sess.name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; margin: 0; padding: 14px 18px; }
    @media print {
      body { padding: 0; }
      @page { size: A4 landscape; margin: 10mm 12mm; }
    }
  </style>
</head>
<body>
  <div style="display:flex;gap:18px;align-items:flex-start;">
    <!-- Sidebar -->
    <div style="width:190px;flex-shrink:0;border-right:2px solid #e0e0e0;padding-right:14px;padding-top:2px;">
      <h1 style="margin:0 0 4px;font-size:15px;font-weight:800;line-height:1.25;color:#1a1a1a;">${sess.name}</h1>
      ${meta ? `<div style="font-size:10px;color:#666;margin-bottom:10px;">${meta}</div>` : ""}
      <div style="border-top:1px solid #e8e8e8;padding-top:10px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:5px;">Modelo de Juego</div>
        <div style="font-size:10px;color:#555;margin-bottom:2px;">${ctx.gameMomentName}</div>
        <div style="font-size:10px;color:#555;margin-bottom:2px;">${ctx.zoneName}</div>
        <div style="font-size:10px;color:#555;margin-bottom:8px;">Escenario ${ctx.scenarioOrder} — ${ctx.scenarioName}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:4px;">Subprincipio</div>
        <div style="font-size:11px;font-weight:700;color:#1a6fa3;line-height:1.3;margin-bottom:8px;">${ctx.subPrincipleLabel}: ${ctx.subPrincipleName}</div>
        ${ctx.tacticalPrinciples.length > 0 ? `
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;margin-bottom:4px;">Principios tácticos</div>
        ${principlesHtml}` : ""}
      </div>
    </div>
    <!-- Exercises -->
    <div style="flex:1;min-width:0;">
      ${sectionHtml}
    </div>
  </div>
</body>
</html>`;
}

function handlePrint(sess: TrainingSession, exercises: SessionExerciseItem[], ctx: PrintContext) {
  const html = buildPrintHtml(sess, exercises, ctx);
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

function SessionCard({ sess, clubId, teamId, subSubPrincipleId, printContext }: {
  sess: TrainingSession;
  clubId: string;
  teamId: string;
  subSubPrincipleId: string | null;
  printContext: PrintContext;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [exercises, setExercises] = useState<SessionExerciseItem[] | null>(null);
  const [loadingEx, setLoadingEx] = useState(false);
  const [selectedEx, setSelectedEx] = useState<SessionExerciseItem | null>(null);

  // Edit exercise
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);

  // Add exercise panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSection, setAddSection] = useState<ExerciseSection>("Principal");
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Exercise | null>(null);
  const [savingAdd, setSavingAdd] = useState(false);

  const reloadExercises = async () => {
    const detail = await trainingService.getSessionById(sess.id);
    setExercises(detail.exercises.slice().sort((a, b) => a.order - b.order));
  };

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

  const handleRemoveFromSession = async (taskTrainingId: string) => {
    if (!exercises) return;
    const newExs = exercises.filter(e => e.taskTrainingId !== taskTrainingId);
    try {
      await trainingService.updateSession(sess.id, buildUpdateReq(sess, newExs));
      setExercises(newExs);
    } catch { /* silent */ }
  };

  const handleEditSaved = async () => {
    setEditingEx(null);
    await reloadExercises();
  };

  const handleOpenAddPanel = async () => {
    setShowAddPanel(true);
    setSelectedToAdd(null);
    if (availableExercises.length === 0) {
      setLoadingAvail(true);
      try {
        const exs = await trainingService.getExercises(clubId);
        setAvailableExercises(exs);
      } catch { /* silent */ } finally {
        setLoadingAvail(false);
      }
    }
  };

  const handleAddToSession = async () => {
    if (!selectedToAdd) return;
    const currentExs = exercises ?? [];
    const newExs: SessionExerciseItem[] = [...currentExs, {
      taskTrainingId: `temp_${Date.now()}`,
      order: currentExs.length,
      exerciseId: selectedToAdd.id,
      name: selectedToAdd.name,
      description: selectedToAdd.description,
      type: selectedToAdd.type,
      section: addSection,
      durationTotal: selectedToAdd.durationTotal,
      playersNumber: selectedToAdd.playersNumber,
      goalPeekersNumber: selectedToAdd.goalPeekersNumber,
      fieldSpace: selectedToAdd.fieldSpace,
      urlImage: selectedToAdd.urlImage ?? null,
      skills: selectedToAdd.skills,
      conditions: selectedToAdd.conditions,
    }];
    setSavingAdd(true);
    try {
      await trainingService.updateSession(sess.id, buildUpdateReq(sess, newExs));
      await reloadExercises();
      setShowAddPanel(false);
      setSelectedToAdd(null);
    } catch { /* silent */ } finally {
      setSavingAdd(false);
    }
  };

  const handleOpenCreateEx = () => {
    setShowAddPanel(false);
    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    if (subSubPrincipleId) createParams.set("subSubPrincipleId", subSubPrincipleId);

    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `${location.pathname}${location.search}` },
    });
  };

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
        <IconButton
          size="small"
          className={styles.addExHeaderBtn}
          title="Añadir ejercicio"
          onClick={(e) => { e.stopPropagation(); handleOpenAddPanel(); }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          className={styles.printBtn}
          title="Imprimir sesión"
          onClick={(e) => {
            e.stopPropagation();
            if (exercises !== null) {
              handlePrint(sess, exercises, printContext);
            } else {
              setLoadingEx(true);
              trainingService
                .getSessionById(sess.id)
                .then((detail) => {
                  const sorted = detail.exercises.slice().sort((a, b) => a.order - b.order);
                  setExercises(sorted);
                  handlePrint(sess, sorted, printContext);
                })
                .catch(() => setExercises([]))
                .finally(() => setLoadingEx(false));
            }
          }}
        >
          <PrintIcon fontSize="small" />
        </IconButton>
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
                    {secExercises.length === 0 ? (
                      <Typography className={styles.exEmptySection}>Esta sección no tiene ejercicios</Typography>
                    ) : secExercises.map((ex, idx) => (
                      <Box key={ex.taskTrainingId} className={styles.exCard} onClick={() => setSelectedEx(ex)}>
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

                          {/* ── Card actions ── */}
                          <Box className={styles.exCardActions}>
                            <Tooltip title="Editar ejercicio">
                              <IconButton
                                size="small"
                                className={styles.exActionBtn}
                                onClick={(e) => { e.stopPropagation(); setEditingEx(sessionItemToExercise(ex)); }}
                              >
                                <EditOutlinedIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar de la sesión">
                              <IconButton
                                size="small"
                                className={`${styles.exActionBtn} ${styles.exActionBtnDelete}`}
                                onClick={(e) => { e.stopPropagation(); handleRemoveFromSession(ex.taskTrainingId); }}
                              >
                                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
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

      {/* ── Add exercise modal ────────────── */}
      <Dialog
        open={showAddPanel}
        onClose={() => { setShowAddPanel(false); setSelectedToAdd(null); }}
        maxWidth="xs"
        fullWidth
        classes={{ paper: styles.addExModalPaper }}
      >
        <DialogTitle className={styles.addExModalTitle}>
          Añadir ejercicio a la sesión
          <IconButton
            size="small"
            onClick={() => { setShowAddPanel(false); setSelectedToAdd(null); }}
            className={styles.addExModalClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent className={styles.addExModalContent}>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Sección</InputLabel>
            <Select
              value={addSection}
              label="Sección"
              onChange={(e: SelectChangeEvent) => setAddSection(e.target.value as ExerciseSection)}
            >
              {SECTION_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {loadingAvail ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Autocomplete
              options={availableExercises}
              getOptionLabel={(ex) => ex.name}
              value={selectedToAdd}
              onChange={(_, v) => setSelectedToAdd(v)}
              fullWidth
              size="small"
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(params) => <TextField {...params} label="Ejercicio existente" />}
            />
          )}
        </DialogContent>
        <DialogActions className={styles.addExModalActions}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateEx}
            className={styles.addExNewBtn}
          >
            Nuevo ejercicio
          </Button>
          <Button
            size="small"
            onClick={() => { setShowAddPanel(false); setSelectedToAdd(null); }}
            className={styles.addExModalCancelBtn}
          >
            Cancelar
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!selectedToAdd || savingAdd}
            onClick={handleAddToSession}
            className={styles.addExConfirmBtn}
          >
            {savingAdd ? <CircularProgress size={14} /> : "Añadir"}
          </Button>
        </DialogActions>
      </Dialog>

      <ExerciseModal ex={selectedEx} onClose={() => setSelectedEx(null)} />

      {/* Edit existing exercise */}
      <ExerciseDialog
        open={editingEx !== null}
        clubId={clubId}
        subSubPrincipleId={subSubPrincipleId}
        exercise={editingEx}
        onClose={() => setEditingEx(null)}
        onSaved={handleEditSaved}
      />
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
        clubId: state.clubId,
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
            sessions.map((sess) => (
              <SessionCard
                key={sess.id}
                sess={sess}
                clubId={state.clubId}
                teamId={state.teamId}
                subSubPrincipleId={null}
                printContext={{
                  gameMomentName: state.gameMomentName,
                  zoneName: state.zoneName,
                  scenarioName: state.scenario.name,
                  scenarioOrder: state.scenario.order,
                  subPrincipleLabel: state.subPrinciple.label,
                  subPrincipleName: state.subPrinciple.name,
                  tacticalPrinciples: state.subPrinciple.tacticalPrinciples,
                }}
              />
            ))
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
