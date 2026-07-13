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
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
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
import trainingService from "../../services/trainingService";
import type { Exercise, TrainingSession } from "../../types/training";
import ExerciseCromo from "./components/ExerciseCromo";
import SessionDialog from "./components/SessionDialog";
import type { TacticalBoardSnapshot } from "./new/types";
import { getDimensionsPercent, getShapeVertices } from "./new/helpers/spaceGeometry";
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

function parseBoardSnapshot(boardStateJson?: string | null): TacticalBoardSnapshot | null {
  if (!boardStateJson) return null;
  try {
    return JSON.parse(boardStateJson) as TacticalBoardSnapshot;
  } catch {
    return null;
  }
}

function buildSnapshotSvg(snapshot: TacticalBoardSnapshot): string {
  const spaces = snapshot.placedSpaces ?? [];
  const materials = snapshot.placedMaterials ?? [];
  const lines = snapshot.placedLines ?? [];
  const chapas = Object.entries(snapshot.placedChapas ?? {});

  const lineMarkup = lines
    .map((line) => {
      const length = Math.max(1, Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
      const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * (180 / Math.PI);
      return `<div style="position:absolute;left:${line.x1}%;top:${line.y1}%;width:${length}%;height:2px;transform:rotate(${angle}deg);transform-origin:0 50%;background:${line.color};opacity:0.95;"></div>`;
    })
    .join("");

  const spaceMarkup = spaces
    .map((space) => {
      const size = getDimensionsPercent(space.kind, space.scaleX, space.scaleY);
      const vertices = getShapeVertices(space.kind).map((v) => `${v.x},${v.y}`).join(" ");
      const color = space.color ?? "#4d9de0";
      const common = `position:absolute;left:${space.x}%;top:${space.y}%;width:${size.width}%;height:${size.height}%;transform:translate(-50%,-50%) rotate(${space.rotation}deg);transform-origin:center center;`;
      if (space.kind === "circle") {
        return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="${common}"><circle cx="50" cy="50" r="50" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></circle></svg>`;
      }
      return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="${common}"><polygon points="${vertices}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"></polygon></svg>`;
    })
    .join("");

  const materialMarkup = materials
    .map((material) => {
      const size = 4.5 * Math.max(material.scaleX ?? 1, material.scaleY ?? 1);
      return `<div style="position:absolute;left:${material.x}%;top:${material.y}%;width:${size}%;height:${size}%;transform:translate(-50%,-50%) rotate(${material.rotation}deg);border-radius:50%;background:linear-gradient(160deg,#f5f5f5 0%,#8c8c8c 100%);box-shadow:0 0 0 1px rgba(255,255,255,.3);"></div>`;
    })
    .join("");

  const chapaMarkup = chapas
    .map(([id, chapa], index) => {
      const color = chapa.anonymous ? `hsl(${(index * 47) % 360} 75% 46%)` : "#4d9de0";
      const background = chapa.anonymous
        ? `linear-gradient(160deg, hsl(${(index * 47) % 360} 75% 58%) 0%, hsl(${(index * 47) % 360} 75% 36%) 100%)`
        : `linear-gradient(160deg, ${color} 0%, #245f94 100%)`;
      const size = Math.max(6, 5.8 * (chapa.scaleX ?? 1));
      return `<div title="${escapeHtml(id)}" style="position:absolute;left:${chapa.x}%;top:${chapa.y}%;width:${size}%;aspect-ratio:1 / 1;transform:translate(-50%,-50%) rotate(${chapa.rotation ?? 0}deg);border-radius:50%;background:${background};box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),0 1px 3px rgba(0,0,0,.35);"></div>`;
    })
    .join("");

  return `
    <div style="position:relative;width:100%;aspect-ratio:16 / 9;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#2f7b43 0%,#28683a 100%);box-shadow:inset 0 0 0 2px rgba(255,255,255,.14),inset 0 0 0 6px rgba(14,40,22,.5);">
      <div style="position:absolute;inset:8px;border:1px solid rgba(245,255,247,.8);border-radius:12px;"></div>
      <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(245,255,247,.72);"></div>
      <div style="position:absolute;left:50%;top:50%;width:22%;height:22%;transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(245,255,247,.72);"></div>
      <div style="position:absolute;left:0;top:28%;width:18%;height:44%;border:1px solid rgba(245,255,247,.72);border-left:none;"></div>
      <div style="position:absolute;left:0;top:37%;width:9%;height:26%;border:1px solid rgba(245,255,247,.72);border-left:none;"></div>
      ${lineMarkup}
      ${spaceMarkup}
      ${materialMarkup}
      ${chapaMarkup}
    </div>
  `;
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
  const snapshot = parseBoardSnapshot(exercise.boardStateJson);
  const snapshotHtml = snapshot ? buildSnapshotSvg(snapshot) : "";
  const conditionsHtml = exercise.conditions?.length
    ? `<div class="section"><h3>Condiciones</h3><ul>${exercise.conditions
        .map((condition) => `<li>${escapeHtml(condition.text)}</li>`)
        .join("")}</ul></div>`
    : "";

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
        .section ul { margin: 0; padding-left: 18px; }
        .boardWrap { border: 1px solid #c9d8e6; border-radius: 14px; padding: 10px; }
        .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .stat { border: 1px solid #d9e4ee; border-radius: 10px; padding: 8px 10px; background: #f8fbfe; }
        .statValue { display: block; font-size: 20px; font-weight: 700; line-height: 1; }
        .statLabel { display: block; margin-top: 3px; font-size: 11px; color: #5a6f85; text-transform: uppercase; letter-spacing: .04em; }
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
              <span class="pill">${escapeHtml(exercise.type)}</span>
              <span class="pill">${escapeHtml(exercise.section)}</span>
              ${exercise.subSubPrincipleName ? `<span class="pill">${escapeHtml(exercise.subSubPrincipleName)}</span>` : ""}
            </div>
          </div>
          <div class="stats" style="min-width: 280px; max-width: 320px;">
            <div class="stat"><span class="statValue">${exercise.durationTotal}</span><span class="statLabel">min</span></div>
            <div class="stat"><span class="statValue">${exercise.playersNumber}</span><span class="statLabel">jug.</span></div>
            <div class="stat"><span class="statValue">${exercise.goalPeekersNumber}</span><span class="statLabel">port.</span></div>
            <div class="stat"><span class="statValue">${exercise.skills.length}</span><span class="statLabel">skills</span></div>
          </div>
        </div>

        ${exercise.description ? `<div class="section"><h3>Descripción</h3><p>${escapeHtml(exercise.description)}</p></div>` : ""}

        ${exercise.urlImage ? `<div class="boardWrap"><img src="${escapeHtml(mediaUrl(exercise.urlImage))}" alt="${escapeHtml(exercise.name)}" /></div>` : snapshotHtml ? `<div class="boardWrap">${snapshotHtml}</div>` : ""}

        ${conditionsHtml}
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
  const initialSspId = params.get("subSubPrincipleId") ?? null;
  const initialSspName = params.get("sspName") ?? null;

  const [tab, setTab] = useState(0);

  // ── Exercises state ──────────────────────────────────────────────
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [deleteExId, setDeleteExId] = useState<string | null>(null);
  const [deletingEx, setDeletingEx] = useState(false);

  // ── Sessions state ───────────────────────────────────────────────
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loadingSess, setLoadingSess] = useState(false);
  const [sessDialogOpen, setSessDialogOpen] = useState(false);
  const [editSession, setEditSession] = useState<TrainingSession | null>(null);
  const [deleteSessId, setDeleteSessId] = useState<string | null>(null);
  const [deletingSess, setDeletingSess] = useState(false);

  const clubId = team?.club?.id ?? "";

  // Load exercises
  useEffect(() => {
    if (!clubId) return;
    setLoadingEx(true);
    trainingService.getExercises(clubId, initialSspId ?? undefined)
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoadingEx(false));
  }, [clubId, initialSspId]);

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
    trainingService.getExercises(clubId, initialSspId ?? undefined)
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

  const goToExercisePage = (exerciseId?: string) => {
    if (!clubId) return;

    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    if (initialSspId) createParams.set("subSubPrincipleId", initialSspId);
    if (initialSspName) createParams.set("sspName", initialSspName);
    if (exerciseId) createParams.set("exerciseId", exerciseId);

    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `/coach/trainings${location.search}` },
    });
  };

  const duplicateExercise = (exerciseId: string) => {
    if (!clubId) return;

    const createParams = new URLSearchParams();
    createParams.set("clubId", clubId);
    if (teamId) createParams.set("teamId", teamId);
    if (initialSspId) createParams.set("subSubPrincipleId", initialSspId);
    if (initialSspName) createParams.set("sspName", initialSspName);
    createParams.set("duplicateFrom", exerciseId);

    navigate(`/coach/trainings/new-exercise?${createParams.toString()}`, {
      state: { returnTo: `/coach/trainings${location.search}` },
    });
  };

  const handleDeleteExercise = async () => {
    if (!deleteExId) return;
    setDeletingEx(true);
    try {
      await trainingService.deleteExercise(deleteExId);
      setDeleteExId(null);
      refreshExercises();
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
            {tab === 0 && (
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
            {tab === 1 && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                variant="contained"
                className={styles.addBtn}
                onClick={() => { setEditSession(null); setSessDialogOpen(true); }}
                disabled={!teamId || !clubId}
              >
                Nueva sesión
              </Button>
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
            <Tab label="Ejercicios" />
            <Tab label="Sesiones" />
          </Tabs>

          {/* ── Exercises tab ──────────────────────────────────── */}
          {tab === 0 && (
            <Box>
              {initialSspName && (
                <Box className={styles.toolbarRow}>
                  <Chip
                    label={`Filtro: ${initialSspName}`}
                    size="small"
                    className={styles.filterLabel}
                    onDelete={() => navigate(`/coach/trainings?teamId=${teamId}`)}
                  />
                </Box>
              )}

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
          {tab === 1 && (
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
                      {sess.subPrincipleName && (
                        <Chip label={sess.subPrincipleName} size="small" className={styles.sspChip} />
                      )}
                    </Box>
                  </Box>
                  <Box className={styles.sessionActions}>
                    <Tooltip title="Editar">
                      <IconButton size="small" className={styles.iconBtn}
                        onClick={() => { setEditSession(sess); setSessDialogOpen(true); }}>
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

        {/* ── Session dialog ────────────────────────────────────── */}
        <SessionDialog
          open={sessDialogOpen}
          teamId={teamId}
          clubId={clubId}
          session={editSession}
          onClose={() => setSessDialogOpen(false)}
          onSaved={() => { setSessDialogOpen(false); refreshSessions(); }}
        />

        {/* ── Delete exercise confirmation ──────────────────────── */}
        <Dialog open={!!deleteExId} onClose={() => setDeleteExId(null)}
          PaperProps={{ sx: { bgcolor: "#07071a", border: "1px solid rgba(77,157,224,.25)" } }}>
          <DialogTitle sx={{ color: "#4d9de0" }}>Eliminar ejercicio</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "#e8e8e8" }}>
              ¿Seguro que quieres eliminar este ejercicio? Esta acción no se puede deshacer.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteExId(null)} sx={{ color: "rgba(212, 212, 212, .6)" }}>
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
      </ContentLayout>
    </BaseLayout>
  );
}

