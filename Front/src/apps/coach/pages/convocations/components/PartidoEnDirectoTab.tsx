import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import { getIdealLineup } from "../../../services/idealLineupService";
import { getFormations } from "../../../services/formationService";
import { FORMATION_POSITIONS } from "../../../types/formation";
import type { Formation } from "../../../types/formation";
import { useLiveMatch } from "../hooks/useLiveMatch";
import LiveMatchTimer from "./simulation/LiveMatchTimer";
import LiveMatchScoreboard from "./simulation/LiveMatchScoreboard";
import GoalTimeline from "./simulation/GoalTimeline";
import LiveMatchRecoveryDialog from "./simulation/LiveMatchRecoveryDialog";
import LiveMatchManualEditDialog from "./simulation/LiveMatchManualEditDialog";
import SimulationField from "./simulation/SimulationField";
import SubstitutionWindowTracker from "./simulation/SubstitutionWindowTracker";
import SubstitutionHistoryPanel from "./simulation/SubstitutionHistoryPanel";
import MatchCompetitivenessReport from "./simulation/MatchCompetitivenessReport";
import type { SimSlotPlayer } from "./simulation/SimulationPlayerSlot";
import type { SquadPlayer } from "../../squad/components/IdealLineup";
import { saveMatchParticipation } from "../../../services/liveMatchService";
import type { LiveMatchParticipationPayload, PlayerParticipationDto } from "./simulation/liveMatch.types";
import styles from "./PartidoEnDirectoTab.module.css";
import simStyles from "./SimulacionTab.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  eventId: string | null;
  lineupPlayers: SquadPlayer[];
  localTeamName: string;
  localTeamShield?: string | null;
  visitorTeamName: string;
  visitorTeamShield?: string | null;
  /** true if the user's team is the local/home team */
  isHomeTeam?: boolean;
}

// ─── Bench player card ────────────────────────────────────────────────────────

function BenchPlayerCard({
  player,
  isDragActive,
  isLeaving,
  minutesPlayed,
  hasPlayed,
}: {
  player: SquadPlayer;
  isDragActive: boolean;
  isLeaving: boolean;
  minutesPlayed?: number;
  hasPlayed?: boolean;
}) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      className={`${simStyles.benchCard} ${isDragActive ? simStyles.benchCardDragging : ""} ${isLeaving ? simStyles.benchCardLeaving : ""}`}
      title={player.displayName}
    >
      {player.photoSrc ? (
        <img src={player.photoSrc} alt={player.displayName} className={simStyles.benchCardAvatar} />
      ) : (
        <div className={simStyles.benchCardInitials}>{initials}</div>
      )}
      <div className={simStyles.benchCardInfo}>
        <div className={simStyles.benchCardNameRow}>
          {player.dorsal != null && (
            <span className={simStyles.benchCardDorsal}>{player.dorsal}</span>
          )}
          <span className={simStyles.benchCardName}>
            {player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ")}
          </span>
        </div>
        <div className={simStyles.benchCardMeta}>
          {player.position && (
            <span className={simStyles.benchCardPosition}>{player.position}</span>
          )}
          {player.competitiveness != null && (
            <span
              className={`${simStyles.benchCompTag} ${
                player.competitiveness >= 8
                  ? simStyles.benchCompHigh
                  : player.competitiveness >= 6
                    ? simStyles.benchCompMid
                    : simStyles.benchCompLow
              }`}
            >
              ★{Math.round(player.competitiveness)}
            </span>
          )}
        </div>
      </div>
      {!isLeaving ? (
        hasPlayed
          ? <span className={simStyles.benchMinTag}>{minutesPlayed}&apos;</span>
          : <span className={simStyles.benchNoPlayTag}>—</span>
      ) : (
        <span className={simStyles.benchCardSaleBadge}>SALE</span>
      )}
    </div>
  );
}

function DraggableBenchCard({
  player,
  isLeaving,
  minutesPlayed,
  hasPlayed,
}: {
  player: SquadPlayer;
  isLeaving: boolean;
  minutesPlayed?: number;
  hasPlayed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sim-player-${player.id}`,
  });
  const style = { transform: CSS.Translate.toString(transform) };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={simStyles.benchDragHandle}>
      <BenchPlayerCard player={player} isDragActive={isDragging} isLeaving={isLeaving} minutesPlayed={minutesPlayed} hasPlayed={hasPlayed} />
    </div>
  );
}

function DroppableBench({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "sim-bench" });
  return (
    <div ref={setNodeRef} className={`${simStyles.benchZone} ${isOver ? simStyles.benchZoneOver : ""}`}>
      {children}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function PartidoEnDirectoTab({
  teamId,
  eventId,
  lineupPlayers,
  localTeamName,
  localTeamShield,
  visitorTeamName,
  visitorTeamShield,
  isHomeTeam = true,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationId, setFormationId] = useState<string>("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const [manualMinuteOverrides, setManualMinuteOverrides] = useState<Record<string, number>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Confirmation dialog for substitution window
  const [windowConfirmOpen, setWindowConfirmOpen] = useState(false);

  const live = useLiveMatch(eventId, teamId, isHomeTeam);

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // ── Load formations + saved lineup ───────────────────────────────────────
  useEffect(() => {
    if (!teamId || !eventId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);

    Promise.all([getFormations(), getIdealLineup(teamId, eventId)])
      .then(([formList, lineup]) => {
        if (!mounted) return;
        setFormations(formList);
        if (!lineup) {
          setLoading(false);
          return;
        }
        setFormationId(lineup.formationId);
        const slotMap: Record<number, string | null> = {};
        lineup.slots.forEach((s) => { slotMap[s.slotIndex] = s.teamPlayerId; });
        live.initMatch(slotMap);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, eventId]);

  // ── Players lookup ───────────────────────────────────────────────────────
  const playersById = useMemo<Record<string, SimSlotPlayer>>(
    () =>
      Object.fromEntries(
        lineupPlayers.map((p) => [
          p.id,
          {
            teamPlayerId: p.id,
            displayName: p.displayName,
            alias: p.alias,
            photoSrc: p.photoSrc,
            dorsal: p.dorsal,
            competitiveness: p.competitiveness,
          },
        ]),
      ),
    [lineupPlayers],
  );

  // ── Formation slot definitions ────────────────────────────────────────────
  const slotDefs = useMemo(() => {
    const formation = formations.find((f) => f.id === formationId);
    if (!formation) return [];
    return FORMATION_POSITIONS[formation.name] ?? [];
  }, [formations, formationId]);

  // ── Bench players ─────────────────────────────────────────────────────────
  const benchPlayers = useMemo(() => {
    const activeSlots = live.prepareMode ? live.prepareSlotsPreview : live.slots;
    const onFieldIds = new Set(Object.values(activeSlots).filter(Boolean) as string[]);
    return lineupPlayers.filter((p) => !onFieldIds.has(p.id));
  }, [lineupPlayers, live.prepareMode, live.prepareSlotsPreview, live.slots]);

  const leavingIds = useMemo(() => {
    if (!live.prepareMode) return new Set<string>();
    const realOnField = new Set(Object.values(live.slots).filter(Boolean) as string[]);
    const previewOnField = new Set(Object.values(live.prepareSlotsPreview).filter(Boolean) as string[]);
    const leaving = new Set<string>();
    for (const pid of realOnField) {
      if (!previewOnField.has(pid)) leaving.add(pid);
    }
    return leaving;
  }, [live.prepareMode, live.slots, live.prepareSlotsPreview]);

  const prepareBenchPlayers = useMemo(() => {
    if (!live.prepareMode) return benchPlayers;
    const onPreviewField = new Set(Object.values(live.prepareSlotsPreview).filter(Boolean) as string[]);
    return lineupPlayers.filter((p) => !onPreviewField.has(p.id));
  }, [lineupPlayers, live.prepareMode, live.prepareSlotsPreview, benchPlayers]);

  // ── Players on field (for scoreboard scorer selection) ───────────────────
  const fieldPlayers = useMemo<SimSlotPlayer[]>(() => {
    const onFieldIds = new Set(Object.values(live.slots).filter(Boolean) as string[]);
    return lineupPlayers
      .filter((p) => onFieldIds.has(p.id))
      .map((p) => playersById[p.id])
      .filter(Boolean) as SimSlotPlayer[];
  }, [lineupPlayers, live.slots, playersById]);

  // ── Scorer IDs (for goal badge) ──────────────────────────────────────────
  const scorerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of live.goals) {
      if (g.scorerId) ids.add(g.scorerId);
    }
    return ids;
  }, [live.goals]);

  // ── Competitiveness ratings for window snapshot ──────────────────────────
  const currentFieldRatings = useMemo<Record<string, number | null>>(() => {
    const activeSlots = live.prepareMode ? live.prepareSlotsPreview : live.slots;
    const result: Record<string, number | null> = {};
    for (const pid of Object.values(activeSlots)) {
      if (pid) result[pid] = playersById[pid]?.competitiveness ?? null;
    }
    return result;
  }, [live.prepareMode, live.prepareSlotsPreview, live.slots, playersById]);

  // ── Competitiveness averages ─────────────────────────────────────────────
  const fieldCompAvg = useMemo(() => {
    const activeSlotsNow = live.prepareMode ? live.prepareSlotsPreview : live.slots;
    const fieldIds = new Set(Object.values(activeSlotsNow).filter(Boolean) as string[]);
    const vals = lineupPlayers
      .filter((p) => fieldIds.has(p.id) && p.competitiveness != null)
      .map((p) => p.competitiveness as number);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [lineupPlayers, live.slots, live.prepareMode, live.prepareSlotsPreview]);

  const benchCompAvg = useMemo(() => {
    const activeSlotsNow = live.prepareMode ? live.prepareSlotsPreview : live.slots;
    const fieldIds = new Set(Object.values(activeSlotsNow).filter(Boolean) as string[]);
    const vals = lineupPlayers
      .filter((p) => !fieldIds.has(p.id) && p.competitiveness != null)
      .map((p) => p.competitiveness as number);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [lineupPlayers, live.slots, live.prepareMode, live.prepareSlotsPreview]);

  // ── DnD handlers ─────────────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    if (!live.prepareMode) return;
    const draggedId = (active.id as string).replace("sim-player-", "");
    if (!over) return;
    const overId = over.id as string;
    if (overId.startsWith("sim-slot-")) {
      const targetSlotIndex = parseInt(overId.replace("sim-slot-", ""));
      const fromEntry = Object.entries(live.prepareSlotsPreview).find(([, pid]) => pid === draggedId);
      const fromSlotIndex = fromEntry ? parseInt(fromEntry[0]) : null;
      if (fromSlotIndex === null && (live.prepareSlotsPreview[targetSlotIndex] ?? null) === null) return;
      live.movePreparePlayer(draggedId, fromSlotIndex, targetSlotIndex);
    } else if (overId === "sim-bench") {
      const fromEntry = Object.entries(live.prepareSlotsPreview).find(([, pid]) => pid === draggedId);
      if (fromEntry) live.movePreparePlayerToBench(draggedId, parseInt(fromEntry[0]));
    }
  }

  // ── Commit window with rating snapshot ───────────────────────────────────
  function handleCommitWindow() {
    live.commitWindow(currentFieldRatings);
    setWindowConfirmOpen(true);
  }

  // ── Manual edit save ─────────────────────────────────────────────────────
  const handleManualSave = useCallback(async (overrides: Record<string, number>) => {
    setManualMinuteOverrides(overrides);
    if (!eventId) return;

    const players: PlayerParticipationDto[] = lineupPlayers.map((p) => ({
      teamPlayerId: p.id,
      minutesPlayed: overrides[p.id] ?? 0,
      isStarter: Object.values(live.initialSlots).includes(p.id),
      enteredAtMinute: null,
      exitedAtMinute: null,
    }));

    const payload: LiveMatchParticipationPayload = {
      teamId,
      scoreLocal: live.scoreLocal,
      scoreVisitor: live.scoreVisitor,
      matchPhase: "finished",
      players,
      substitutionWindowsJson: JSON.stringify(live.windows),
      ratingSnapshotsJson: JSON.stringify(live.ratingSnapshots),
      goalsJson: JSON.stringify(live.goals),
    };

    await saveMatchParticipation(eventId, payload);
  }, [eventId, teamId, lineupPlayers, live.initialSlots, live.scoreLocal, live.scoreVisitor, live.windows, live.ratingSnapshots, live.goals]);

  // ── Effective minutes (manual override wins) ─────────────────────────────
  const effectiveMinutes = useMemo<Record<string, number>>(() => {
    if (Object.keys(manualMinuteOverrides).length === 0) return live.playerMinutes;
    return { ...live.playerMinutes, ...manualMinuteOverrides };
  }, [live.playerMinutes, manualMinuteOverrides]);

  const activeDragPlayer = activeDragId
    ? playersById[activeDragId.replace("sim-player-", "")]
    : null;

  // ── Guard states ──────────────────────────────────────────────────────────
  if (!eventId) {
    return (
      <div className={simStyles.center}>
        <EmptyState description="No se encontró el partido en el sistema interno." />
      </div>
    );
  }
  if (loading) {
    return (
      <div className={simStyles.center}>
        <CircularProgress size={32} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={simStyles.center}>
        <EmptyState description="Error cargando los datos. Inténtalo de nuevo." />
      </div>
    );
  }
  if (!live.initialized || slotDefs.length === 0) {
    return (
      <div className={simStyles.center}>
        <EmptyState description="Guarda primero la alineación en la pestaña 'Alineación' para poder iniciar el partido." />
      </div>
    );
  }

  // ── Field + bench content ─────────────────────────────────────────────────
  const fieldAndPanel = (
    <div className={simStyles.main}>
      <SimulationField
        slotDefs={slotDefs}
        slots={live.slots}
        prepareSlotsPreview={live.prepareMode ? live.prepareSlotsPreview : undefined}
        playersById={playersById}
        playerMinutes={effectiveMinutes}
        prepareMode={live.prepareMode}
        scorerIds={scorerIds}
      />
      <div className={simStyles.rightColumn}>
        <div className={simStyles.sidePanel}>
          <div className={simStyles.panelHeader}>
            {live.prepareMode ? "Disponibles para el cambio" : "Banquillo"}
            <span className={simStyles.panelBadge}>
              {live.prepareMode ? prepareBenchPlayers.length : benchPlayers.length}
            </span>
          </div>
          {live.prepareMode ? (
            <DroppableBench>
              {prepareBenchPlayers.length === 0 ? (
                <p className={simStyles.emptyBench}>Todos los jugadores están en el campo</p>
              ) : (
                prepareBenchPlayers.map((p) => (
                  <DraggableBenchCard
                    key={p.id}
                    player={p}
                    isLeaving={leavingIds.has(p.id)}
                    minutesPlayed={effectiveMinutes[p.id] ?? 0}
                    hasPlayed={(live.playerStates[p.id]?.accumulatedMinutes ?? 0) > 0 || live.playerStates[p.id]?.isOnField === true}
                  />
                ))
              )}
            </DroppableBench>
          ) : (
            <div className={simStyles.benchZoneStatic}>
              {benchPlayers.length === 0 ? (
                <p className={simStyles.emptyBench}>No hay jugadores en el banquillo</p>
              ) : (
                benchPlayers.map((p) => (
                  <BenchPlayerCard
                    key={p.id}
                    player={p}
                    isDragActive={false}
                    isLeaving={false}
                    minutesPlayed={effectiveMinutes[p.id] ?? 0}
                    hasPlayed={(live.playerStates[p.id]?.accumulatedMinutes ?? 0) > 0}
                  />
                ))
              )}
            </div>
          )}
        </div>
        <SubstitutionHistoryPanel windows={live.windows} playersById={playersById} />
      </div>
    </div>
  );

  return (
    <div className={simStyles.root}>
      {/* Backup recovery dialog */}
      {live.backup && (
        <LiveMatchRecoveryDialog
          backup={live.backup}
          onAccept={live.acceptBackup}
          onDiscard={live.discardBackup}
        />
      )}

      {/* Scoreboard */}
      <LiveMatchScoreboard
        localTeamName={localTeamName}
        localTeamShield={localTeamShield}
        visitorTeamName={visitorTeamName}
        visitorTeamShield={visitorTeamShield}
        scoreLocal={live.scoreLocal}
        scoreVisitor={live.scoreVisitor}
        matchPhase={live.matchPhase}
        fieldPlayers={fieldPlayers}
        isHomeTeam={isHomeTeam}
        onAddGoal={live.addGoal}
      />

      {/* Goal timeline */}
      <GoalTimeline goals={live.goals} onRemoveGoal={live.removeGoal} />

      {/* Timer + window tracker bar */}
      <div className={simStyles.topBar}>
        <LiveMatchTimer
          matchPhase={live.matchPhase}
          currentMinute={live.currentMinute}
          currentSecond={live.currentSecond}
          half={live.half}
          isHalftime={live.isHalftime}
          halfDuration={live.halfDuration}
          onHalfDurationChange={live.setHalfDuration}
          pendingAction={live.pendingAction}
          onRequestAction={live.setPendingAction}
          onConfirmAction={live.confirmAction}
          onCancelAction={live.cancelAction}
        />
        <SubstitutionWindowTracker
          windowsTotal={live.windowsTotal}
          windowsInSecondHalf={live.windowsInSecondHalf}
          canOpenWindow={live.canOpenWindow}
          half={live.half}
          prepareMode={live.prepareMode}
          onPrepare={live.startPrepare}
          onCancel={live.cancelPrepare}
          onCommit={handleCommitWindow}
        />
      </div>

      {/* Rating bar */}
      {(fieldCompAvg !== null || benchCompAvg !== null) && (
        <div className={simStyles.ratingBar}>
          <span className={simStyles.ratingBarLabel}>Media competitividad:</span>
          {fieldCompAvg !== null && (
            <span className={`${simStyles.ratingBarItem} ${
              fieldCompAvg >= 8 ? simStyles.ratingBarHigh
              : fieldCompAvg >= 6 ? simStyles.ratingBarMid
              : simStyles.ratingBarLow
            }`}>
              ★ {Math.round(fieldCompAvg)} campo
            </span>
          )}
          {benchCompAvg !== null && (
            <span className={`${simStyles.ratingBarItem} ${simStyles.ratingBarBench}`}>
              ★ {Math.round(benchCompAvg)} banquillo
            </span>
          )}
        </div>
      )}

      {/* Field + bench inside DndContext */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {fieldAndPanel}
        <DragOverlay>
          {activeDragPlayer && (
            <div className={simStyles.dragOverlay}>
              {activeDragPlayer.photoSrc ? (
                <img src={activeDragPlayer.photoSrc} alt={activeDragPlayer.displayName} className={simStyles.dragOverlayPhoto} />
              ) : (
                <span className={simStyles.dragOverlayInitials}>
                  {activeDragPlayer.displayName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase()}
                </span>
              )}
              <span className={simStyles.dragOverlayName}>
                {activeDragPlayer.alias?.trim() || activeDragPlayer.displayName.split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Save state feedback */}
      {live.isSaving && (
        <div className={styles.savingBanner}>
          <CircularProgress size={16} />
          <span>Guardando datos del partido…</span>
        </div>
      )}

      {/* Competitiveness report — shown at end of match */}
      {live.matchPhase === "finished" && live.windows.length > 0 && (
        <MatchCompetitivenessReport
          initialSlots={live.initialSlots}
          windows={live.windows}
          finalSlots={live.slots}
          playerMinutes={effectiveMinutes}
          playersById={playersById}
        />
      )}

      {/* Manual edit button and explicit save button — only after match ends */}
      {live.matchPhase === "finished" && (
        <div className={styles.postMatchActions}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => setManualEditOpen(true)}
          >
            Edición manual de minutos
          </Button>
          {!live.hasSavedData && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={live.isSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              disabled={live.isSaving}
              onClick={live.requestSave}
            >
              Guardar datos del partido
            </Button>
          )}
        </div>
      )}

      {/* Read-only saved data summary */}
      {live.hasSavedData && live.savedParticipationData && (
        <div className={styles.savedDataBanner}>
          <div className={styles.savedDataHeader}>
            <span className={styles.savedDataTitle}>✅ Partido guardado</span>
            <span className={styles.savedDataScore}>
              {localTeamName} <strong>{live.savedParticipationData.scoreLocal}</strong>
              {" : "}
              <strong>{live.savedParticipationData.scoreVisitor}</strong> {visitorTeamName}
            </span>
          </div>
          <GoalTimeline
            goals={(() => {
              try { return JSON.parse(live.savedParticipationData.goalsJson ?? "[]"); }
              catch { return []; }
            })()}
            onRemoveGoal={() => {}}
            readOnly
          />
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={live.isDeleting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineIcon />}
            disabled={live.isDeleting}
            onClick={() => setDeleteConfirmOpen(true)}
            sx={{ mt: 1 }}
          >
            Eliminar datos del partido
          </Button>
        </div>
      )}

      {/* Save confirmation dialog */}
      <Dialog
        open={live.isSaveConfirmOpen}
        onClose={live.cancelSave}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, minWidth: 300 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
          Guardar datos del partido
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.88rem" }}>
          ¿Guardar los datos del partido en los jugadores?
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={live.cancelSave} color="inherit" size="small">Cancelar</Button>
          <Button onClick={live.confirmSave} variant="contained" color="success" size="small">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete saved data confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, minWidth: 300 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
          Eliminar datos del partido
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.88rem" }}>
          Se eliminarán los datos guardados y se restarán de las estadísticas de los jugadores. Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit" size="small">Cancelar</Button>
          <Button
            onClick={async () => { setDeleteConfirmOpen(false); await live.deleteParticipation(); }}
            variant="contained" color="error" size="small"
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Window confirmation dialog */}
      <Dialog
        open={windowConfirmOpen}
        onClose={() => { setWindowConfirmOpen(false); }}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3 } }}
      >
        <DialogTitle sx={{ color: "#fff" }}>Cambio confirmado</DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.7)" }}>
          {live.lastCommittedWindow && live.lastCommittedWindow.swaps.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {live.lastCommittedWindow.swaps.map((s, i) => (
                <li key={i} style={{ fontSize: "0.85rem", marginBottom: 4 }}>
                  <span style={{ color: "#22c55e" }}>
                    {playersById[s.inPlayerId]?.alias?.trim() || playersById[s.inPlayerId]?.displayName || s.inPlayerId}
                  </span>
                  {" entra por "}
                  <span style={{ color: "#f87171" }}>
                    {s.outPlayerId
                      ? (playersById[s.outPlayerId]?.alias?.trim() || playersById[s.outPlayerId]?.displayName || s.outPlayerId)
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span>Cambio de táctica sin sustitución.</span>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => { live.dismissConfirmation(); setWindowConfirmOpen(false); }} variant="contained" size="small">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual edit dialog */}
      <LiveMatchManualEditDialog
        open={manualEditOpen}
        onClose={() => setManualEditOpen(false)}
        lineupPlayers={lineupPlayers}
        currentMinutes={effectiveMinutes}
        onSave={handleManualSave}
      />

      {/* Error snackbar */}
      <Snackbar
        open={live.saveError !== null}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={live.dismissSaveError}>
          {live.saveError}
        </Alert>
      </Snackbar>
    </div>
  );
}
