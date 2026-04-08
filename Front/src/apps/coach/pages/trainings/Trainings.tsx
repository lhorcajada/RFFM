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
import trainingService from "../../services/trainingService";
import type { Exercise, TrainingSession } from "../../types/training";
import ExerciseDialog from "./components/ExerciseDialog";
import SessionDialog from "./components/SessionDialog";
import styles from "./Trainings.module.css";

const TYPE_LABELS: Record<string, string> = {
  Physical: "Físico",
  Technical: "Técnico",
  Tactical: "Táctico",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(t: string) {
  return t ? t.slice(0, 5) : "";
}

export default function Trainings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { team, teamTitleNode } = useTeamAndClub();

  const params = new URLSearchParams(location.search);
  const teamId = params.get("teamId") ?? "";
  const initialSspId = params.get("subSubPrincipleId") ?? null;
  const initialSspName = params.get("sspName") ?? null;

  const [tab, setTab] = useState(0);

  // ── Exercises state ──────────────────────────────────────────────
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [exDialogOpen, setExDialogOpen] = useState(false);
  const [editExercise, setEditExercise] = useState<Exercise | null>(null);
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
              onClick={() => navigate(-1)}
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
                onClick={() => { setEditExercise(null); setExDialogOpen(true); }}
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
              ) : exercises.map(ex => (
                <Box key={ex.id} className={styles.exerciseCard}>
                  <Box className={styles.exerciseInfo}>
                    <Typography className={styles.exerciseName}>{ex.name}</Typography>
                    <Box className={styles.exerciseMeta}>
                      <Chip label={TYPE_LABELS[ex.type] ?? ex.type} size="small" className={styles.typeChip} />
                      <Typography className={styles.sessionMetaText}>
                        {ex.durationTotal} min · {ex.playersNumber} jug.
                      </Typography>
                      {ex.subSubPrincipleName && (
                        <Chip label={ex.subSubPrincipleName} size="small" className={styles.sspChip} />
                      )}
                      {ex.skills.map(sk => (
                        <Chip key={sk.essentialSkillId} label={sk.skillName} size="small" className={styles.skillChip} />
                      ))}
                    </Box>
                  </Box>
                  <Box className={styles.exerciseActions}>
                    <Tooltip title="Editar">
                      <IconButton size="small" className={styles.iconBtn}
                        onClick={() => { setEditExercise(ex); setExDialogOpen(true); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" className={styles.deleteIconBtn}
                        onClick={() => setDeleteExId(ex.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
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

        {/* ── Exercise dialog ──────────────────────────────────── */}
        <ExerciseDialog
          open={exDialogOpen}
          clubId={clubId}
          subSubPrincipleId={initialSspId}
          subSubPrincipleName={initialSspName}
          exercise={editExercise}
          onClose={() => setExDialogOpen(false)}
          onSaved={() => { setExDialogOpen(false); refreshExercises(); }}
        />

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
          PaperProps={{ sx: { bgcolor: "#1e1e1e", border: "1px solid rgba(0,122,204,.25)" } }}>
          <DialogTitle sx={{ color: "#007ACC" }}>Eliminar ejercicio</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "#d4d4d4" }}>
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
          PaperProps={{ sx: { bgcolor: "#1e1e1e", border: "1px solid rgba(0,122,204,.25)" } }}>
          <DialogTitle sx={{ color: "#007ACC" }}>Eliminar sesión</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ color: "#d4d4d4" }}>
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

