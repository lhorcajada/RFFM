import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GroupsIcon from "@mui/icons-material/Groups";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import ConfirmDialog from "../../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import { getIdealLineup } from "../../../services/idealLineupService";
import { getFormations } from "../../../services/formationService";
import { getTeamById, type TeamResponse } from "../../../services/teamService";
import { FORMATION_POSITIONS, FULL_TEAM_PLAYERS, formationsForPlayerCount } from "../../../types/formation";
import type { Formation } from "../../../types/formation";
import { useLiveMatch } from "../hooks/useLiveMatch";
import LiveMatchTimer from "./simulation/LiveMatchTimer";
import LiveMatchScoreboard from "./simulation/LiveMatchScoreboard";
import GoalTimeline from "./simulation/GoalTimeline";
import LiveMatchRecoveryDialog from "./simulation/LiveMatchRecoveryDialog";
import LiveMatchManualEditDialog, { type ManualEditFinalValues } from "./simulation/LiveMatchManualEditDialog";
import LiveMatchEventButtons from "./simulation/LiveMatchEventButtons";
import SimulationField from "./simulation/SimulationField";
import SubstitutionWindowTracker from "./simulation/SubstitutionWindowTracker";
import SubstitutionHistoryPanel from "./simulation/SubstitutionHistoryPanel";
import CardsTimeline from "./simulation/CardsTimeline";
import MatchCompetitivenessReport from "./simulation/MatchCompetitivenessReport";
import type { SimSlotPlayer } from "./simulation/SimulationPlayerSlot";
import type { SquadPlayer } from "../../squad/components/IdealLineup";
import { DroppableBench } from "./simulation/BenchPlayerCard";
import MatchPlayersDialog from "./MatchPlayersDialog";
import { CompactBenchCard, DraggableCompactBenchCard } from "./simulation/CompactBenchCard";
import { saveMatchParticipation, updateMatchParticipationReason } from "../../../services/liveMatchService";
import type { LiveMatchParticipationPayload, PlayerParticipationDto } from "./simulation/liveMatch.types";
import MinutesReasonEditor from "./MinutesReasonEditor";
import { getCardStatus, getExpelledIds, type CardStatus } from "../utils/expulsions";
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
  /** true when the sport event's match category is "Friendly" — disables the substitution-window quota */
  isFriendly?: boolean;
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
  isFriendly = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const [manualMinuteOverrides, setManualMinuteOverrides] = useState<Record<string, number>>({});
  const [minutesReasons, setMinutesReasons] = useState<Record<string, string | null>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Confirmation dialog for substitution window
  const [windowConfirmOpen, setWindowConfirmOpen] = useState(false);
  // Confirmation dialog for mid-match formation change — holds the pending target formation id
  const [pendingFormationId, setPendingFormationId] = useState<string | null>(null);
  const [playersDialogOpen, setPlayersDialogOpen] = useState(false);
  const [team, setTeam] = useState<TeamResponse | null>(null);

  const live = useLiveMatch(eventId, teamId, isHomeTeam, {
    unlimitedWindows: isFriendly,
    players: lineupPlayers.map((p) => ({ id: p.id, displayName: p.displayName })),
  });

  const halfDurationTouchedRef = useRef(false);

  const handleHalfDurationChange = useCallback(
    (minutes: number) => {
      halfDurationTouchedRef.current = true;
      live.setHalfDuration(minutes);
    },
    [live],
  );

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
        const slotMap: Record<number, string | null> = {};
        lineup.slots.forEach((s) => { slotMap[s.slotIndex] = s.teamPlayerId; });
        const startingFormation = formList.find((f) => f.id === lineup.formationId);
        live.initMatch(slotMap, startingFormation ? { id: startingFormation.id, name: startingFormation.name } : null);
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

  // ── Load team (for the category's standard half duration) ────────────────
  useEffect(() => {
    if (!teamId) {
      setTeam(null);
      return;
    }

    let mounted = true;
    getTeamById(teamId).then((t) => {
      if (mounted) setTeam(t);
    });

    return () => { mounted = false; };
  }, [teamId]);

  // ── Apply the category's standard half duration as the default, unless
  // the coach already edited it manually or the match already started ──────
  useEffect(() => {
    if (team?.standardHalfDurationMinutes == null) return;
    if (halfDurationTouchedRef.current) return;
    if (live.matchPhase !== "preMatch") return;
    live.setHalfDuration(team.standardHalfDurationMinutes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, live.matchPhase]);

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
            readiness: p.readiness,
            readinessBreakdown: p.readinessBreakdown,
            fatigue: p.fatigue,
            // Estado de forma de backend: foto previa al partido, no se recalcula en vivo con los minutos.
            formStatus: p.formStatus,
          },
        ]),
      ),
    [lineupPlayers],
  );

  // ── Cards: what each player's photo shows, and who has been sent off ──────
  const expelledIds = useMemo(() => getExpelledIds(live.cards), [live.cards]);

  const cardStatusById = useMemo<Record<string, CardStatus>>(
    () => Object.fromEntries(lineupPlayers.map((p) => [p.id, getCardStatus(live.cards, p.id)])),
    [lineupPlayers, live.cards],
  );

  // ── Formation: the one on the field, and the ones the team may switch to ──
  const formationId = live.currentFormation?.id ?? "";

  const slotDefs = useMemo(
    () => (live.currentFormation ? (FORMATION_POSITIONS[live.currentFormation.name] ?? []) : []),
    [live.currentFormation],
  );

  const selectableFormations = useMemo(() => {
    const allowedPlayers = FULL_TEAM_PLAYERS - expelledIds.size;
    const forAllowedPlayers = formationsForPlayerCount(allowedPlayers, formations);
    const current = live.currentFormation;
    const currentIsListed = !current || forAllowedPlayers.some((f) => f.id === current.id);
    return currentIsListed ? forAllowedPlayers : [current, ...forAllowedPlayers];
  }, [formations, expelledIds, live.currentFormation]);

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

  // Players currently on the field (or on the prepare preview) — read-only "En el campo" list
  const onFieldPlayers = useMemo(() => {
    const activeSlots = live.prepareMode ? live.prepareSlotsPreview : live.slots;
    const onFieldIds = new Set(Object.values(activeSlots).filter(Boolean) as string[]);
    return lineupPlayers.filter((p) => onFieldIds.has(p.id));
  }, [lineupPlayers, live.prepareMode, live.prepareSlotsPreview, live.slots]);

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
    if (!over) return;
    const activeRaw = String(active.id ?? "");
    const draggedMatch = activeRaw.match(/^sim-player-(?:bench-|list-)?(.+)$/);
    const draggedId = draggedMatch ? draggedMatch[1] : activeRaw.replace(/^sim-player-/, "");
    const overId = over.id as string;
    if (expelledIds.has(draggedId)) return;

    if (live.prepareMode) {
      if (overId.startsWith("sim-slot-")) {
        const targetSlotIndex = parseInt(overId.replace("sim-slot-", ""));
        const fromEntry = Object.entries(live.prepareSlotsPreview).find(([, pid]) => pid === draggedId);
        const fromSlotIndex = fromEntry ? parseInt(fromEntry[0]) : null;
        live.movePreparePlayer(draggedId, fromSlotIndex, targetSlotIndex);
      } else if (overId === "sim-bench") {
        const fromEntry = Object.entries(live.prepareSlotsPreview).find(([, pid]) => pid === draggedId);
        if (fromEntry) live.movePreparePlayerToBench(draggedId, parseInt(fromEntry[0]));
      }
      return;
    }

    // Outside "preparar cambio": free repositioning of on-field players is
    // always allowed (no substitution window needed) — only field-to-field
    // swaps, never involving the bench (bringing a bench player on, or
    // sending a field player off, still requires startPrepare/commitWindow).
    if (overId.startsWith("sim-slot-")) {
      const targetSlotIndex = parseInt(overId.replace("sim-slot-", ""));
      const fromEntry = Object.entries(live.slots).find(([, pid]) => pid === draggedId);
      if (!fromEntry) return;
      const fromSlotIndex = parseInt(fromEntry[0]);
      live.repositionPlayer(fromSlotIndex, targetSlotIndex);
    }
  }

  // ── Commit window with rating snapshot ───────────────────────────────────
  function handleCommitWindow() {
    live.commitWindow(currentFieldRatings);
    setWindowConfirmOpen(true);
  }

  // ── Formation change: applied directly before kick-off (it just redefines
  // the starting lineup), confirmed and recorded in the history mid-match ───
  const canChangeFormation = live.matchPhase !== "finished";
  const pendingFormation = selectableFormations.find((f) => f.id === pendingFormationId) ?? null;

  function slotsForFormation(formation: Formation): Record<number, string | null> {
    const newSlotDefs = FORMATION_POSITIONS[formation.name] ?? [];
    const onFieldPlayerIds = Object.values(live.slots).filter(Boolean) as string[];
    const newSlots: Record<number, string | null> = {};
    newSlotDefs.forEach((slotDef, idx) => {
      newSlots[slotDef.slotIndex] = onFieldPlayerIds[idx] ?? null;
    });
    return newSlots;
  }

  function handleFormationSelectChange(newFormationId: string) {
    if (!newFormationId || newFormationId === formationId) return;
    if (live.matchPhase === "preMatch") {
      const formation = selectableFormations.find((f) => f.id === newFormationId);
      if (!formation) return;
      live.initMatch(slotsForFormation(formation), { id: formation.id, name: formation.name });
      return;
    }
    setPendingFormationId(newFormationId);
  }

  function handleCancelFormationChange() {
    setPendingFormationId(null);
  }

  function handleConfirmFormationChange() {
    if (!pendingFormation) {
      setPendingFormationId(null);
      return;
    }
    live.changeFormation(pendingFormation.id, pendingFormation.name, slotsForFormation(pendingFormation));
    setPendingFormationId(null);
  }

  // ── Seed manual minute overrides from saved data ──────────────────────────
  useEffect(() => {
    if (!live.savedParticipationData) return;
    setManualMinuteOverrides((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const seeded: Record<string, number> = {};
      for (const p of live.savedParticipationData!.players) {
        seeded[p.teamPlayerId] = p.minutesPlayed;
      }
      return seeded;
    });
  }, [live.savedParticipationData]);

  // ── Seed minutes reasons from saved data ──────────────────────────────────
  useEffect(() => {
    if (!live.savedParticipationData) return;
    setMinutesReasons((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const seeded: Record<string, string | null> = {};
      for (const p of live.savedParticipationData!.players) {
        seeded[p.teamPlayerId] = p.minutesReason ?? null;
      }
      return seeded;
    });
  }, [live.savedParticipationData]);

  // ── Save a single player's post-match minutes reason ─────────────────────
  const handleSaveMinutesReason = useCallback(
    async (teamPlayerId: string, reason: string | null) => {
      if (!eventId) return;
      await updateMatchParticipationReason(eventId, teamPlayerId, reason);
      setMinutesReasons((prev) => ({ ...prev, [teamPlayerId]: reason }));
    },
    [eventId],
  );

  // ── Manual edit save ─────────────────────────────────────────────────────
  const handleManualSave = useCallback(async (overrides: Record<string, number>, finalValues: ManualEditFinalValues) => {
    setManualMinuteOverrides(overrides);
    if (!eventId) return;

    const savedStarterById = new Map(
      (live.savedParticipationData?.players ?? []).map((p) => [p.teamPlayerId, p.isStarter]),
    );
    const players: PlayerParticipationDto[] = lineupPlayers.map((p) => ({
      teamPlayerId: p.id,
      minutesPlayed: overrides[p.id] ?? 0,
      isStarter: savedStarterById.has(p.id)
        ? savedStarterById.get(p.id)!
        : Object.values(live.initialSlots).includes(p.id),
      enteredAtMinute: null,
      exitedAtMinute: null,
    }));

    const payload: LiveMatchParticipationPayload = {
      teamId,
      scoreLocal: finalValues.scoreLocal,
      scoreVisitor: finalValues.scoreVisitor,
      matchPhase: "finished",
      players,
      substitutionWindowsJson: JSON.stringify(finalValues.windows),
      ratingSnapshotsJson: JSON.stringify(live.ratingSnapshots),
      goalsJson: JSON.stringify(live.goals),
      cardsJson: JSON.stringify(live.cards),
      formationChangesJson: JSON.stringify(live.formationChanges),
      matchDurationMinutes: finalValues.matchDurationMinutes,
    };

    await saveMatchParticipation(eventId, payload);
  }, [eventId, teamId, lineupPlayers, live.initialSlots, live.ratingSnapshots, live.goals, live.cards, live.formationChanges, live.savedParticipationData]);

  // ── Starters (saved data wins: after a reload the lineup may no longer match) ──
  const starterIds = useMemo<string[]>(() => {
    const savedPlayers = live.savedParticipationData?.players;
    if (savedPlayers) return savedPlayers.filter((p) => p.isStarter).map((p) => p.teamPlayerId);
    return Object.values(live.initialSlots).filter((pid): pid is string => !!pid);
  }, [live.savedParticipationData, live.initialSlots]);

  // ── Effective minutes (manual override wins) ─────────────────────────────
  const effectiveMinutes = useMemo<Record<string, number>>(() => {
    if (Object.keys(manualMinuteOverrides).length === 0) return live.playerMinutes;
    return { ...live.playerMinutes, ...manualMinuteOverrides };
  }, [live.playerMinutes, manualMinuteOverrides]);

  const activeDragPlayer = activeDragId
    ? (() => {
        const m = String(activeDragId).match(/^sim-player-(?:bench-|list-)?(.+)$/);
        const pid = m ? m[1] : String(activeDragId).replace(/^sim-player-/, "");
        return playersById[pid];
      })()
    : null;

  // ── Guard states ──────────────────────────────────────────────────────────
  if (!eventId) {
    return (
      <div className={simStyles.center}>
        <EmptyState description="No se encontró el partido en el sistema interno. Asegúrate de que el evento esté creado en el área de Partidos del equipo." />
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

  // ── Field + side column ───────────────────────────────────────────────────
  // Full-screen layout: the field takes the available height and the side
  // column (compact draggable bench, event timelines, substitution history,
  // post-match summary) scrolls on its own, so the page never needs vertical
  // scroll on a tablet. The rich, read-only "En el campo" / "Banquillo" lists
  // open on demand in the "Jugadores" popup (MatchPlayersDialog).

  const currentBenchPlayers = live.prepareMode ? prepareBenchPlayers : benchPlayers;

  const ratingBar = (fieldCompAvg !== null || benchCompAvg !== null) && (
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
  );

  const savedDataBanner = live.hasSavedData && live.savedParticipationData && (
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
      <CardsTimeline
        cards={(() => {
          try { return JSON.parse(live.savedParticipationData.cardsJson ?? "[]"); }
          catch { return []; }
        })()}
        onRemoveCard={() => {}}
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
  );

  const fieldAndPanel = (
    <div className={styles.liveMain}>
      <SimulationField
        className={styles.liveField}
        slotDefs={slotDefs}
        slots={live.slots}
        prepareSlotsPreview={live.prepareMode ? live.prepareSlotsPreview : undefined}
        playersById={playersById}
        playerMinutes={effectiveMinutes}
        prepareMode={live.prepareMode}
        freeRepositionEnabled={!live.prepareMode && live.matchPhase !== "finished"}
        scorerIds={scorerIds}
        cardStatusById={cardStatusById}
      />
      <div className={styles.liveSideColumn}>
        {ratingBar}
        <div className={simStyles.sidePanel}>
          <div className={simStyles.panelHeader}>
            {live.prepareMode ? "Disponibles para el cambio" : "Banquillo"}
            <span className={simStyles.panelBadge}>{currentBenchPlayers.length}</span>
          </div>

          {currentBenchPlayers.length === 0 ? (
            <p className={simStyles.emptyBench}>
              {live.prepareMode ? "Todos los jugadores están en el campo" : "No hay jugadores en el banquillo"}
            </p>
          ) : live.prepareMode ? (
            <DroppableBench>
              <div className={simStyles.compactBenchItems}>
                {currentBenchPlayers.map((p) =>
                  expelledIds.has(p.id) ? (
                    <CompactBenchCard
                      key={p.id}
                      player={p}
                      minutesPlayed={effectiveMinutes[p.id] ?? 0}
                      cardStatus={cardStatusById[p.id]}
                    />
                  ) : (
                    <DraggableCompactBenchCard
                      key={p.id}
                      player={p}
                      isLeaving={leavingIds.has(p.id)}
                      minutesPlayed={effectiveMinutes[p.id] ?? 0}
                      cardStatus={cardStatusById[p.id]}
                    />
                  ),
                )}
              </div>
            </DroppableBench>
          ) : (
            <div className={simStyles.compactBenchItems}>
              {currentBenchPlayers.map((p) => (
                <CompactBenchCard
                  key={p.id}
                  player={p}
                  isLeaving={false}
                  minutesPlayed={effectiveMinutes[p.id] ?? 0}
                  cardStatus={cardStatusById[p.id]}
                />
              ))}
            </div>
          )}
        </div>
        <LiveMatchEventButtons
          matchPhase={live.matchPhase}
          fieldPlayers={fieldPlayers}
          currentMinute={live.currentMinute}
          onAddGoal={live.addGoal}
          onAddCard={live.addCard}
        />
        <GoalTimeline goals={live.goals} onRemoveGoal={live.removeGoal} />
        <CardsTimeline cards={live.cards} onRemoveCard={live.removeCard} />
        <SubstitutionHistoryPanel windows={live.windows} playersById={playersById} />
        {savedDataBanner}
        {live.matchPhase === "finished" && live.windows.length > 0 && (
          <MatchCompetitivenessReport
            initialSlots={live.initialSlots}
            windows={live.windows}
            finalSlots={live.slots}
            playerMinutes={effectiveMinutes}
            halfDuration={live.halfDuration}
            playersById={playersById}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      {/* Backup recovery dialog */}
      {live.backup && (
        <LiveMatchRecoveryDialog
          backup={live.backup}
          onAccept={live.acceptBackup}
          onDiscard={live.discardBackup}
        />
      )}

      {/* Scoreboard + formation + players popup — always rendered, so nothing
          shifts when the match starts */}
      <div className={styles.toolbar}>
        <div className={styles.scoreboardSlot}>
          <LiveMatchScoreboard
            localTeamName={localTeamName}
            localTeamShield={localTeamShield}
            visitorTeamName={visitorTeamName}
            visitorTeamShield={visitorTeamShield}
            scoreLocal={live.scoreLocal}
            scoreVisitor={live.scoreVisitor}
          />
        </div>
        {selectableFormations.length > 0 && (
          <FormControl size="small" className={styles.formationSelect}>
            <InputLabel id="live-formation-select-label">Esquema</InputLabel>
            <Select
              labelId="live-formation-select-label"
              label="Esquema"
              value={formationId}
              disabled={!canChangeFormation}
              onChange={(e) => handleFormationSelectChange(e.target.value as string)}
            >
              {selectableFormations.map((f) => (
                <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={<GroupsIcon />}
          onClick={() => setPlayersDialogOpen(true)}
        >
          Jugadores
        </Button>
      </div>

      {/* Timer + window tracker bar (+ post-match actions once finished) */}
      <div className={styles.topBar}>
        <LiveMatchTimer
          matchPhase={live.matchPhase}
          currentMinute={live.currentMinute}
          currentSecond={live.currentSecond}
          half={live.half}
          isHalftime={live.isHalftime}
          halfDuration={live.halfDuration}
          onHalfDurationChange={handleHalfDurationChange}
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
          unlimitedWindows={live.unlimitedWindows}
          onPrepare={live.startPrepare}
          onCancel={live.cancelPrepare}
          onCommit={handleCommitWindow}
        />
        {live.matchPhase === "finished" && (
          <div className={styles.postMatchActions}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setManualEditOpen(true)}
            >
              Edición manual del partido
            </Button>
            {live.hasSavedData && live.savedParticipationData && (
              <MinutesReasonEditor
                players={live.savedParticipationData.players.map((p) => {
                  const player = playersById[p.teamPlayerId];
                  return {
                    id: p.teamPlayerId,
                    label: player?.alias?.trim() || player?.displayName || p.teamPlayerId,
                    reason: minutesReasons[p.teamPlayerId] ?? null,
                  };
                })}
                onSave={(playerId, reason) => handleSaveMinutesReason(playerId, reason)}
              />
            )}
          </div>
        )}
        {live.isSaving && (
          <div className={styles.savingBanner}>
            <CircularProgress size={16} />
            <span>Guardando datos del partido…</span>
          </div>
        )}
      </div>

      {/* Field + side column inside DndContext */}
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

      {/* Players popup: rich, read-only "En el campo" + "Banquillo" */}
      <MatchPlayersDialog
        open={playersDialogOpen}
        onClose={() => setPlayersDialogOpen(false)}
        onFieldPlayers={onFieldPlayers}
        benchPlayers={currentBenchPlayers}
        minutesById={effectiveMinutes}
        hasPlayed={(id) => (live.playerStates[id]?.accumulatedMinutes ?? 0) > 0 || live.playerStates[id]?.isOnField === true}
        isLeaving={(id) => live.prepareMode && leavingIds.has(id)}
      />

      {/* An expulsion that leaves fewer than 7 players ends the match */}
      <ConfirmDialog
        open={!!live.pendingMinPlayersCard}
        title="El equipo se queda con menos de 7 jugadores"
        description="Con esta expulsión el árbitro debe dar el partido por terminado. Se finalizará y se guardará con el marcador actual; después podrás corregirlo en la edición manual."
        confirmText="Finalizar partido"
        onCancel={live.cancelMinPlayersEnd}
        onConfirm={live.confirmMinPlayersEnd}
      />

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

      {/* Formation change confirmation dialog */}
      <Dialog
        open={pendingFormationId !== null}
        onClose={handleCancelFormationChange}
        PaperProps={{ sx: { bgcolor: "#19192e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 3, minWidth: 300 } }}
      >
        <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>
          ¿Cambiar a esquema {pendingFormation?.name}?
        </DialogTitle>
        <DialogContent sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.88rem" }}>
          Se guardará el historial de posiciones.
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={handleCancelFormationChange} color="inherit" size="small">Cancelar</Button>
          <Button onClick={handleConfirmFormationChange} variant="contained" color="success" size="small">
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual edit dialog */}
      <LiveMatchManualEditDialog
        open={manualEditOpen}
        onClose={() => setManualEditOpen(false)}
        lineupPlayers={lineupPlayers}
        currentMinutes={effectiveMinutes}
        onSaveMinutes={handleManualSave}
        localTeamName={localTeamName}
        visitorTeamName={visitorTeamName}
        scoreLocal={live.scoreLocal}
        scoreVisitor={live.scoreVisitor}
        onSetScore={live.setScore}
        matchDurationMinutes={live.matchDurationMinutes}
        defaultMatchDurationMinutes={2 * live.halfDuration}
        onSetMatchDuration={live.setMatchDuration}
        goals={live.goals}
        onAddGoal={(payload, minute) =>
          live.addGoal(
            payload.scorerId,
            payload.scorerName,
            payload.scorerDorsal,
            payload.isOwnTeam,
            payload.pitchZone,
            payload.bodyPart,
            minute
          )
        }
        onUpdateGoal={(id, payload, minute) =>
          live.updateGoal(id, { ...payload, minute })
        }
        onRemoveGoal={live.removeGoal}
        cards={live.cards}
        onAddCard={(payload, minute, half) =>
          live.addCard(
            payload.teamPlayerId,
            payload.playerName,
            payload.isRivalPlayer,
            payload.rivalDorsal,
            payload.cardType,
            minute,
            half
          )
        }
        onUpdateCard={(id, payload, minute, half) =>
          live.updateCard(id, { ...payload, minute, half })
        }
        onRemoveCard={live.removeCard}
        windows={live.windows}
        starterIds={starterIds}
        onSetWindows={live.replaceWindows}
      />

      {/* Error snackbar */}
      <Snackbar
        open={live.saveError !== null}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={live.retrySave}>
              Reintentar
            </Button>
          }
        >
          {live.saveError}
        </Alert>
      </Snackbar>
    </div>
  );
}
