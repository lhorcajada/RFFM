import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import trainingService, { hasErrorCode } from "../../services/trainingService";
import seasonPlanService from "../../services/seasonPlanService";
import gameModelService from "../../services/gameModelService";
import seasonService from "../../services/seasonService";
import type { Exercise, ExerciseTipo, TrainingSession } from "../../types/training";
import type { GameZoneCatalogItem, SeasonPlan } from "../../types/seasonPlan";
import { tipoOptions } from "./new/constants";
import ExerciseCromo from "./components/ExerciseCromo";
import SeasonPlanView from "./season-plan/SeasonPlanView";
import SeasonPlanEditor from "./season-plan/SeasonPlanEditor";
import styles from "./Trainings.module.css";
import { client } from "../../../../core/api/client";

const API_BASE = (client.defaults.baseURL ?? "/").replace(/\/$/, "");
function mediaUrl(urlImage: string) {
  if (!urlImage) return urlImage;
  if (urlImage.startsWith("http://") || urlImage.startsWith("https://")) return urlImage;
  return `${API_BASE}/api/local-storage/${urlImage}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(t: string) {
  return t ? t.slice(0, 5) : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function waitForPrintWindowReady(printWindow: Window) {
  if (printWindow.document.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      const handleLoad = () => {
        printWindow.removeEventListener("load", handleLoad);
        resolve();
      };

      printWindow.addEventListener("load", handleLoad);
    });
  }

  const images = Array.from(printWindow.document.images ?? []);
  await Promise.all(
    images.map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  );

  if (printWindow.document.fonts?.ready) {
    await printWindow.document.fonts.ready.catch(() => undefined);
  }

  await new Promise<void>((resolve) => {
    printWindow.requestAnimationFrame(() => {
      printWindow.requestAnimationFrame(() => resolve());
    });
  });
}

async function printExercise(exercise: Exercise) {
  const html = `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(exercise.name)} - PDF</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #102133; background: #fff; }
        .sheet { display: flex; flex-direction: column; gap: 14px; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .title { margin: 0; font-size: 24px; line-height: 1.1; }
        .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; font-size: 12px; color: #38506b; }
        .pill { display: inline-flex; align-items: center; border: 1px solid #c9d8e6; border-radius: 999px; padding: 4px 10px; background: #f6f9fc; }
        .section h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
        .section p, .section li { margin: 0; font-size: 13px; line-height: 1.45; }
        img { display: block; width: 100%; border-radius: 14px; border: 1px solid #c9d8e6; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <div>
            <h1 class="title">${escapeHtml(exercise.name)}</h1>
            <div class="meta">
              <span class="pill">${escapeHtml(exercise.tipo)}</span>
              ${typeof exercise.durationMinutes === "number" ? `<span class="pill">${exercise.durationMinutes} min</span>` : ""}
            </div>
          </div>
        </div>

        <div class="section"><h3>Objetivo</h3><p>${escapeHtml(exercise.objetivo)}</p></div>
        <div class="section"><h3>Logística</h3><p>${escapeHtml(exercise.logistica)}</p></div>
        ${exercise.descripcion ? `<div class="section"><h3>Descripción</h3><p>${escapeHtml(exercise.descripcion)}</p></div>` : ""}

        ${exercise.urlImage ? `<div><img src="${escapeHtml(mediaUrl(exercise.urlImage))}" alt="${escapeHtml(exercise.name)}" /></div>` : ""}
      </div>
    </body>
  </html>`;

  const printWindow = window.open("", "_blank", "width=980,height=1200");
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  try {
    await waitForPrintWindowReady(printWindow);
  } catch {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 300);
    });
  }

  printWindow.focus();
  printWindow.print();
}

export default function Trainings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { team, teamTitleNode } = useTeamAndClub();
  const goToTeamDashboard = useTeamDashboardBack();

  const params = new URLSearchParams(location.search);
  const teamId = params.get("teamId") ?? "";

  // Tab order: Planificación(0) / Ejercicios(1) / Sesiones(2) — Planificación is first
  // (req #4 of the session-exercise-plan-redesign change).
  const [tab, setTab] = useState(0);

  // ── Exercises state ──────────────────────────────────────────────
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [deleteExId, setDeleteExId] = useState<string | null>(null);
  const [deletingEx, setDeletingEx] = useState(false);
  const [deleteExError, setDeleteExError] = useState<string | null>(null);
  const [tipoFilter, setTipoFilter] = useState<ExerciseTipo | "">("");

  // ── Sessions state ───────────────────────────────────────────────
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loadingSess, setLoadingSess] = useState(false);
  const [deleteSessId, setDeleteSessId] = useState<string | null>(null);
  const [deletingSess, setDeletingSess] = useState(false);

  // ── Season plan state ────────────────────────────────────────────
  const [seasonId, setSeasonId] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [seasonPlan, setSeasonPlan] = useState<SeasonPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [zones, setZones] = useState<GameZoneCatalogItem[]>([]);
  const [planEditing, setPlanEditing] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletePlanOpen, setDeletePlanOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const clubId = team?.club?.id ?? "";

  // Load exercises
  useEffect(() => {
    if (!clubId) return;
    setLoadingEx(true);
    trainingService.getExercises(clubId, { tipo: tipoFilter || undefined })
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoadingEx(false));
  }, [clubId, tipoFilter]);

  // Load sessions
  useEffect(() => {
    if (!teamId) return;
    setLoadingSess(true);
    trainingService.getSessions(teamId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingSess(false));
  }, [teamId]);

  const refreshExercises = () => {
    if (!clubId) return;
    setLoadingEx(true);
    trainingService.getExercises(clubId, { tipo: tipoFilter || undefined })
      .then(setExercises)
      .finally(() => setLoadingEx(false));
  };

  const refreshSessions = () => {
    if (!teamId) return;
    setLoadingSess(true);
    trainingService.getSessions(teamId)
      .then(setSessions)
      .finally(() => setLoadingSess(false));
  };

  // Load the club's active season once (SeasonPlan.SeasonId is a real FK to Season).
  useEffect(() => {
    let mounted = true;
    seasonService.getActiveSeason().then((active) => {
      if (mounted) {
        setSeasonId(active?.id ?? "");
        setSeasonName(active?.name ?? active?.id ?? "");
      }
    });
    return () => {
      mounted = false;
    };
  }, [clubId]);

  const refreshSeasonPlan = () => {
    if (!teamId || !seasonId) return;
    setLoadingPlan(true);
    seasonPlanService
      .getByTeamIdAndSeason(teamId, seasonId)
      .then(setSeasonPlan)
      .catch(() => setSeasonPlan(null))
      .finally(() => setLoadingPlan(false));
  };

  // Load season plan + zone catalog when the Planificación tab (now tab 0) is opened
  useEffect(() => {
    if (tab !== 0 || !teamId || !seasonId) return;
    refreshSeasonPlan();
    gameModelService.getZones().then(setZones).catch(() => setZones([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, teamId, seasonId]);

  const goToExercisePage = (exerciseId?: string) => {
    if (!clubId) return;

    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    if (exerciseId) createParams.set("exerciseId", exerciseId);

    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `/coach/trainings${location.search}` },
    });
  };

  const goToSessionPage = (sessionId?: string, microcicloId?: string) => {
    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    if (sessionId) createParams.set("sessionId", sessionId);
    if (microcicloId) createParams.set("microcicloId", microcicloId);

    navigate(`/coach/trainings/new-session?${createParams.toString()}`, {
      state: { returnTo: `/coach/trainings${location.search}` },
    });
  };

  const handleSavePlan = async (draft: SeasonPlan) => {
    setSavingPlan(true);
    try {
      const saved = draft.id ? await seasonPlanService.update(draft) : await seasonPlanService.create(draft);
      setSeasonPlan(saved);
      setPlanEditing(false);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!seasonPlan?.id) return;
    setDeletingPlan(true);
    try {
      await seasonPlanService.remove(seasonPlan.id);
      setSeasonPlan(null);
      setDeletePlanOpen(false);
    } finally {
      setDeletingPlan(false);
    }
  };

  const duplicateExercise = (exerciseId: string) => {
    if (!clubId) return;

    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    createParams.set("duplicateFrom", exerciseId);

    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `/coach/trainings${location.search}` },
    });
  };

  const handleDeleteExercise = async () => {
    if (!deleteExId) return;
    setDeletingEx(true);
    setDeleteExError(null);
    try {
      await trainingService.deleteExercise(deleteExId);
      setDeleteExId(null);
      refreshExercises();
    } catch (error) {
      if (hasErrorCode(error, "ExerciseInUseBySession")) {
        setDeleteExError("No se puede eliminar: está en uso en una sesión.");
      } else {
        setDeleteExError("Error al eliminar el ejercicio.");
      }
    } finally {
      setDeletingEx(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessId) return;
    setDeletingSess(true);
    try {
      await trainingService.deleteSession(deleteSessId);
      setDeleteSessId(null);
      refreshSessions();
    } finally {
      setDeletingSess(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode ?? "Entrenamientos"}
        subtitle="Gestión de ejercicios y sesiones"
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {tab === 1 && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                variant="contained"
                className={styles.addBtn}
                onClick={() => goToExercisePage()}
                disabled={!clubId}
              >
                Nuevo ejercicio
              </Button>
            )}
            {tab === 2 && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                variant="contained"
                className={styles.addBtn}
                onClick={() => goToSessionPage()}
                disabled={!teamId || !clubId}
              >
                Nueva sesión
              </Button>
            )}
            {tab === 0 && !planEditing && (
              <>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  variant="contained"
                  className={styles.addBtn}
                  onClick={() => setPlanEditing(true)}
                  disabled={!teamId || !seasonId}
                >
                  {seasonPlan ? "Editar planificación" : "Nueva planificación"}
                </Button>
                {seasonPlan && (
                  <Button
                    size="small"
                    startIcon={<DeleteOutlineIcon />}
                    variant="outlined"
                    color="error"
                    onClick={() => setDeletePlanOpen(true)}
                  >
                    Eliminar planificación
                  </Button>
                )}
              </>
            )}
          </Stack>
        }
      >
        <Box className={styles.page}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            className={styles.tabs}
          >
            <Tab label="Planificación" />
            <Tab label="Ejercicios" />
            <Tab label="Sesiones" />
          </Tabs>

          {/* ── Planificación tab ─────────────────────────────── */}
          {tab === 0 && (
            <Box>
              {planEditing ? (
                <SeasonPlanEditor
                  draft={seasonPlan ?? { id: "", teamId, seasonId, macrociclos: [] }}
                  zones={zones}
                  saving={savingPlan}
                  onSave={handleSavePlan}
                  onCancel={() => setPlanEditing(false)}
                />
              ) : (
                <SeasonPlanView
                  plan={seasonPlan}
                  loading={loadingPlan}
                  onCreatePlan={() => setPlanEditing(true)}
                  onCreateSession={(microcicloId) => goToSessionPage(undefined, microcicloId)}
                  onOpenSession={(sessionId) => goToSessionPage(sessionId)}
                />
              )}
            </Box>
          )}

          {/* ── Exercises tab ──────────────────────────────────── */}
          {tab === 1 && (
            <Box>
              <Box className={styles.toolbarRow}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="tipo-filter-label">Tipo</InputLabel>
                  <Select
                    labelId="tipo-filter-label"
                    label="Tipo"
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value as ExerciseTipo | "")}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {tipoOptions.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {loadingEx ? (
                <Box className={styles.loadingBox}><CircularProgress size={32} /></Box>
              ) : exercises.length === 0 ? (
                <Typography className={styles.emptyText}>
                  {clubId ? "No hay ejercicios creados aún." : "Selecciona un equipo para ver ejercicios."}
                </Typography>
              ) : (
                <Box className={styles.cromoGrid}>
                  {exercises.map(ex => (
                    <ExerciseCromo
                      key={ex.id}
                      exercise={ex}
                      teamId={teamId}
                      onEdit={() => goToExercisePage(ex.id)}
                      onDuplicate={() => duplicateExercise(ex.id)}
                      onPrint={() => printExercise(ex)}
                      onDelete={() => setDeleteExId(ex.id)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* ── Sessions tab ───────────────────────────────────── */}
          {tab === 2 && (
            <Box>
              {loadingSess ? (
                <Box className={styles.loadingBox}><CircularProgress size={32} /></Box>
              ) : sessions.length === 0 ? (
                <Typography className={styles.emptyText}>
                  {teamId ? "No hay sesiones creadas aún." : "Selecciona un equipo para ver sesiones."}
                </Typography>
              ) : sessions.map(sess => (
                <Box key={sess.id} className={styles.sessionCard}>
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
                        label={`${sess.exerciseCount} ej.`}
                        size="small"
                        className={styles.countChip}
                      />
                      {sess.sportEventName && (
                        <Chip label={sess.sportEventName} size="small" className={styles.sspChip} />
                      )}
                      {sess.isAssociatedToPlan ? (
                        <Chip
                          label={sess.microcicloWeekLabel ?? "Plan"}
                          size="small"
                          className={styles.planLinkedChip}
                        />
                      ) : (
                        <Chip label="Independiente" size="small" className={styles.independentChip} />
                      )}
                    </Box>
                  </Box>
                  <Box className={styles.sessionActions}>
                    <Tooltip title="Editar">
                      <IconButton size="small" className={styles.iconBtn}
                        onClick={() => goToSessionPage(sess.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" className={styles.deleteIconBtn}
                        onClick={() => setDeleteSessId(sess.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ── Delete exercise confirmation ──────────────────────── */}
        <Dialog open={!!deleteExId} onClose={() => { setDeleteExId(null); setDeleteExError(null); }}
          PaperProps={{ sx: { bgcolor: "#07071a", border: "1px solid rgba(77,157,224,.25)" } }}>
          <DialogTitle sx={{ color: "#4d9de0" }}>Eliminar ejercicio</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "#e8e8e8" }}>
              {deleteExError ?? "¿Seguro que quieres eliminar este ejercicio? Esta acción no se puede deshacer."}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setDeleteExId(null); setDeleteExError(null); }} sx={{ color: "rgba(212, 212, 212, .6)" }}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteExercise} disabled={deletingEx} variant="contained"
              sx={{ bgcolor: "#c0392b", "&:hover": { bgcolor: "#e74c3c" } }}>
              {deletingEx ? <CircularProgress size={16} /> : "Eliminar"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete session confirmation ───────────────────────── */}
        <Dialog open={!!deleteSessId} onClose={() => setDeleteSessId(null)}
          PaperProps={{ sx: { bgcolor: "#07071a", border: "1px solid rgba(77,157,224,.25)" } }}>
          <DialogTitle sx={{ color: "#4d9de0" }}>Eliminar sesión</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "#e8e8e8" }}>
              ¿Seguro que quieres eliminar esta sesión?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteSessId(null)} sx={{ color: "rgba(212, 212, 212, .6)" }}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteSession} disabled={deletingSess} variant="contained"
              sx={{ bgcolor: "#c0392b", "&:hover": { bgcolor: "#e74c3c" } }}>
              {deletingSess ? <CircularProgress size={16} /> : "Eliminar"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Delete season plan confirmation ───────────────────── */}
        <Dialog open={deletePlanOpen} onClose={() => setDeletePlanOpen(false)}
          PaperProps={{ sx: { bgcolor: "#07071a", border: "1px solid rgba(77,157,224,.25)" } }}>
          <DialogTitle sx={{ color: "#4d9de0" }}>Eliminar planificación</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "#e8e8e8" }}>
              ¿Seguro que quieres eliminar la planificación de temporada? Las sesiones enlazadas
              a sus microciclos no se eliminarán, pero perderán ese enlace.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeletePlanOpen(false)} sx={{ color: "rgba(212, 212, 212, .6)" }}>
              Cancelar
            </Button>
            <Button onClick={handleDeletePlan} disabled={deletingPlan} variant="contained"
              sx={{ bgcolor: "#c0392b", "&:hover": { bgcolor: "#e74c3c" } }}>
              {deletingPlan ? <CircularProgress size={16} /> : "Eliminar"}
            </Button>
          </DialogActions>
        </Dialog>
      </ContentLayout>
    </BaseLayout>
  );
}
