import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import seasonService from "../../../services/seasonService";
import trainingService from "../../../services/trainingService";
import type { SessionTargetDetail } from "../../../types/training";
import { useContentBoardData } from "./hooks/useContentBoardData";
import { useSessionDrop } from "./hooks/useSessionDrop";
import AdnDraggableTree from "./components/AdnDraggableTree";
import SessionBoardPanel from "./components/SessionBoardPanel";
import DragOverlayPreview from "./components/DragOverlayPreview";
import { buildSubSubPrincipioTextoMap, describeDragPayload } from "./components/dragPayload";
import styles from "./ContentBoardPage.module.css";

interface DragPayload {
  kind: "subprincipio" | "subsubprincipio";
  targets: SessionTargetDetail[];
}

/** The content-board: a two-panel drag-and-drop screen — the team's ADN tree on the left,
 * unscheduled ("content-first") sessions on the right — for assigning ADN targets to sessions
 * before they're scheduled. Route target for `trainings/content-board` (design.md F1 of
 * `season-plan-content-board`). */
export default function ContentBoardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const clubId = params.get("clubId") ?? "";
  const teamId = params.get("teamId") ?? "";

  const [season, setSeason] = useState("");
  useEffect(() => {
    let mounted = true;
    seasonService.getActiveSeason().then((active) => {
      if (mounted) setSeason(active?.name ?? active?.id ?? "");
    });
    return () => {
      mounted = false;
    };
  }, []);

  const { gameModel, coverage, sessions, setSessions, loading, refetchSessions, refetchCoverage } =
    useContentBoardData(teamId, season);
  const { addTargets, removeTarget } = useSessionDrop(sessions, setSessions, refetchCoverage);
  const textoMap = useMemo(
    () => (gameModel ? buildSubSubPrincipioTextoMap(gameModel) : new Map<string, string>()),
    [gameModel]
  );
  const completedSubSubPrincipioIds = useMemo(
    () => new Set(coverage?.subSubPrincipios.filter((s) => s.isUsed).map((s) => s.subSubPrincipioId) ?? []),
    [coverage]
  );

  const [activePayload, setActivePayload] = useState<DragPayload | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActivePayload((active.data.current as DragPayload) ?? null);
  }

  function handleDragEnd({ over }: DragEndEvent) {
    setActivePayload(null);
    const overId = over?.id?.toString() ?? null;
    if (!overId?.startsWith("session-drop-")) return;
    const sessionId = overId.replace("session-drop-", "");
    if (activePayload) void addTargets(sessionId, activePayload.targets);
  }

  const backUrl = `/coach/trainings?clubId=${clubId}&teamId=${teamId}`;

  const handleCreateSession = async () => {
    const created = await trainingService.createSession({
      teamId,
      name: "Nueva sesión",
      description: "",
      date: null,
      startTime: null,
      endTime: null,
      location: null,
      sportEventId: null,
      microcicloId: null,
      objetivoGeneral: null,
      mapaCampoTexto: null,
      blocks: [],
      targetSubSubPrincipioIds: [],
    });
    setSessions((prev) => [
      ...prev,
      {
        id: created.id,
        name: "Nueva sesión",
        description: "",
        date: null,
        startTime: null,
        endTime: null,
        location: null,
        sportEventId: null,
        sportEventName: null,
        microcicloId: null,
        microcicloWeekLabel: null,
        isAssociatedToPlan: false,
        exerciseCount: 0,
        targets: [],
      },
    ]);
  };

  const handleRename = async (sessionId: string, name: string) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, name } : s)));
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const detail = await trainingService.getSessionById(sessionId);
    await trainingService.updateSession(sessionId, {
      name,
      description: detail.description,
      date: detail.date,
      startTime: detail.startTime,
      endTime: detail.endTime ?? null,
      location: detail.location ?? null,
      sportEventId: detail.sportEventId ?? null,
      microcicloId: detail.microcicloId ?? null,
      objetivoGeneral: detail.objetivoGeneral ?? null,
      mapaCampoTexto: detail.mapaCampoTexto ?? null,
      blocks: detail.blocks.map((b) => ({
        order: b.order,
        nombre: b.nombre,
        comoConectaConAnterior: b.comoConectaConAnterior,
        rotacionEntreEjercicios: b.rotacionEntreEjercicios ?? null,
        exercises: b.exercises.map((e) => ({ exerciseId: e.exerciseId, position: e.position })),
      })),
      targetSubSubPrincipioIds: session.targets.map((t) => t.subSubPrincipioId),
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteSessionId) return;
    await trainingService.deleteSession(deleteSessionId);
    setDeleteSessionId(null);
    refetchSessions();
  };

  const handleAssignDate = (sessionId: string) => {
    navigate(`/coach/trainings/new-session?clubId=${clubId}&teamId=${teamId}&sessionId=${sessionId}`, {
      state: { returnTo: `/coach/trainings/content-board?clubId=${clubId}&teamId=${teamId}` },
    });
  };

  if (loading) {
    return (
      <Box className={styles.loadingBox}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <Box className={styles.page}>
        <Box className={styles.topBar}>
          <Button startIcon={<ArrowBackIcon />} variant="outlined" size="small" onClick={() => navigate(backUrl)}>
            Volver
          </Button>
          <Typography className={styles.title}>Planificar contenido</Typography>
        </Box>

        {!gameModel ? (
          <Box className={styles.emptyState}>
            <Typography>
              Añade primero el{" "}
              <RouterLink to="/coach/game-model" className={styles.link}>
                Modelo ADN
              </RouterLink>{" "}
              del equipo para poder planificar contenido.
            </Typography>
          </Box>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <Box className={styles.body}>
              <Box className={styles.panel}>
                <AdnDraggableTree gameModel={gameModel} coverage={coverage} />
              </Box>
              <Box className={styles.panel}>
                <SessionBoardPanel
                  sessions={sessions}
                  textoMap={textoMap}
                  completedSubSubPrincipioIds={completedSubSubPrincipioIds}
                  onCreateSession={() => void handleCreateSession()}
                  onRemoveTarget={(sessionId, subSubPrincipioId) => void removeTarget(sessionId, subSubPrincipioId)}
                  onRename={(sessionId, name) => void handleRename(sessionId, name)}
                  onDelete={(sessionId) => setDeleteSessionId(sessionId)}
                  onAssignDate={handleAssignDate}
                />
              </Box>
            </Box>

            <DragOverlay>
              {activePayload && <DragOverlayPreview segments={describeDragPayload(activePayload)} />}
            </DragOverlay>
          </DndContext>
        )}
      </Box>

      <Dialog open={!!deleteSessionId} onClose={() => setDeleteSessionId(null)}>
        <DialogTitle>Eliminar sesión</DialogTitle>
        <DialogContent>
          <DialogContentText>¿Seguro que quieres eliminar esta sesión?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSessionId(null)}>Cancelar</Button>
          <Button onClick={() => void handleConfirmDelete()} variant="contained" color="error">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </BaseLayout>
  );
}
