import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import { getIdealLineup } from "../../../services/idealLineupService";
import { getFormations } from "../../../services/formationService";
import { getTeamById, type TeamResponse } from "../../../services/teamService";
import {
  listSimulations,
  saveSimulation,
  deleteSimulation,
} from "../../../services/simulationService";
import { FORMATION_POSITIONS } from "../../../types/formation";
import type { Formation } from "../../../types/formation";
import type { MatchSimulation } from "./simulation/simulation.types";
import { useMatchSimulation } from "../hooks/useMatchSimulation";
import MatchTimer from "./simulation/MatchTimer";
import SimulationField from "./simulation/SimulationField";
import SubstitutionWindowTracker from "./simulation/SubstitutionWindowTracker";
import SubstitutionHistoryPanel from "./simulation/SubstitutionHistoryPanel";
import SavedSimulationsPanel from "./simulation/SavedSimulationsPanel";
import SimulationConfig from "./simulation/SimulationConfig";
import MatchCompetitivenessReport from "./simulation/MatchCompetitivenessReport";
import type { SimSlotPlayer } from "./simulation/SimulationPlayerSlot";
import type { SquadPlayer } from "../../squad/components/IdealLineup";
import PlayerFormLegend from "../../../components/PlayerFormLegend/PlayerFormLegend";
import {
  BenchPlayerCard,
  DroppableBench,
  groupBenchPlayers,
} from "./simulation/BenchPlayerCard";
import { CompactBenchCard, DraggableCompactBenchCard } from "./simulation/CompactBenchCard";
import styles from "./SimulacionTab.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  eventId: string | null;
  lineupPlayers: SquadPlayer[];
  /** When true (friendly matches), substitution-window quotas are not enforced */
  isFriendly?: boolean;
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function SimulacionTab({ teamId, eventId, lineupPlayers, isFriendly = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationId, setFormationId] = useState<string>("");
  const [initialSlots, setInitialSlots] = useState<Record<number, string | null>>({});
  const [loadError, setLoadError] = useState(false);
  const [savedSims, setSavedSims] = useState<MatchSimulation[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamResponse | null>(null);

  const sim = useMatchSimulation({ enableWindowLimits: !isFriendly });

  const halfDurationTouchedRef = useRef(false);

  const handleHalfDurationChange = useCallback(
    (minutes: number) => {
      halfDurationTouchedRef.current = true;
      sim.setHalfDuration(minutes);
    },
    [sim],
  );

  // ─── DnD sensors ──────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // ─── Load formations + saved lineup ───────────────────────────────────────

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
          setLoadError(false);
          setLoading(false);
          return;
        }

        setFormationId(lineup.formationId);

        const slotMap: Record<number, string | null> = {};
        lineup.slots.forEach((s) => {
          slotMap[s.slotIndex] = s.teamPlayerId;
        });
        setInitialSlots(slotMap);
        sim.initSimulation(slotMap);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, eventId]);

  // ─── Load team (for the category's standard half duration) ────────────────

  useEffect(() => {
    if (!teamId) {
      setTeam(null);
      return;
    }

    let mounted = true;
    getTeamById(teamId).then((t) => {
      if (mounted) setTeam(t);
    });

    return () => {
      mounted = false;
    };
  }, [teamId]);

  // ─── Apply the category's standard half duration as the default, unless
  // the coach already edited it manually or the match already started ──────

  useEffect(() => {
    if (team?.standardHalfDurationMinutes == null) return;
    if (halfDurationTouchedRef.current) return;
    if (sim.isRunning || sim.currentMinute !== 0) return;
    sim.setHalfDuration(team.standardHalfDurationMinutes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, sim.isRunning, sim.currentMinute]);

  // ─── Load saved simulations ────────────────────────────────────────────────

  const refreshSavedSims = useCallback(() => {
    if (!teamId || !eventId) return;
    setSavedSims(listSimulations(teamId, eventId));
  }, [teamId, eventId]);

  useEffect(() => {
    refreshSavedSims();
  }, [refreshSavedSims]);

  // ─── Derived: players lookup (by teamPlayerId = SquadPlayer.id) ────────────

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
          },
        ]),
      ),
    [lineupPlayers],
  );

  // ─── Formation slot definitions ────────────────────────────────────────────

  const slotDefs = useMemo(() => {
    const formation = formations.find((f) => f.id === formationId);
    if (!formation) return [];
    return FORMATION_POSITIONS[formation.name] ?? [];
  }, [formations, formationId]);

  // ─── Bench players: lineupPlayers not currently on the field ──────────────

  const benchPlayers = useMemo(() => {
    const activeSlots = sim.prepareMode ? sim.prepareSlotsPreview : sim.slots;
    const onFieldIds = new Set(
      Object.values(activeSlots).filter(Boolean) as string[],
    );
    return lineupPlayers.filter((p) => !onFieldIds.has(p.id));
  }, [lineupPlayers, sim.prepareMode, sim.prepareSlotsPreview, sim.slots]);

  // Players leaving field in prepare mode (still show in bench with SALE badge)
  const leavingIds = useMemo(() => {
    if (!sim.prepareMode) return new Set<string>();
    const realOnField = new Set(Object.values(sim.slots).filter(Boolean) as string[]);
    const previewOnField = new Set(
      Object.values(sim.prepareSlotsPreview).filter(Boolean) as string[],
    );
    const leaving = new Set<string>();
    for (const pid of realOnField) {
      if (!previewOnField.has(pid)) leaving.add(pid);
    }
    return leaving;
  }, [sim.prepareMode, sim.slots, sim.prepareSlotsPreview]);

  // Bench list in prepare mode includes normal bench + leaving players
  const prepareBenchPlayers = useMemo(() => {
    if (!sim.prepareMode) return benchPlayers;
    const onPreviewField = new Set(
      Object.values(sim.prepareSlotsPreview).filter(Boolean) as string[],
    );
    return lineupPlayers.filter((p) => !onPreviewField.has(p.id));
  }, [lineupPlayers, sim.prepareMode, sim.prepareSlotsPreview, benchPlayers]);

  // Players currently on the field (or on the prepare preview) — read-only "En el campo" list
  const onFieldPlayers = useMemo(() => {
    const activeSlots = sim.prepareMode ? sim.prepareSlotsPreview : sim.slots;
    const onFieldIds = new Set(
      Object.values(activeSlots).filter(Boolean) as string[],
    );
    return lineupPlayers.filter((p) => onFieldIds.has(p.id));
  }, [lineupPlayers, sim.prepareMode, sim.prepareSlotsPreview, sim.slots]);

  // ─── Competitiveness averages ────────────────────────────────────────────

  const fieldCompAvg = useMemo(() => {
    const activeSlotsNow = sim.prepareMode ? sim.prepareSlotsPreview : sim.slots;
    const fieldIds = new Set(Object.values(activeSlotsNow).filter(Boolean) as string[]);
    const vals = lineupPlayers
      .filter((p) => fieldIds.has(p.id) && p.competitiveness != null)
      .map((p) => p.competitiveness as number);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [lineupPlayers, sim.slots, sim.prepareMode, sim.prepareSlotsPreview]);

  const benchCompAvg = useMemo(() => {
    const activeSlotsNow = sim.prepareMode ? sim.prepareSlotsPreview : sim.slots;
    const fieldIds = new Set(Object.values(activeSlotsNow).filter(Boolean) as string[]);
    const vals = lineupPlayers
      .filter((p) => !fieldIds.has(p.id) && p.competitiveness != null)
      .map((p) => p.competitiveness as number);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [lineupPlayers, sim.slots, sim.prepareMode, sim.prepareSlotsPreview]);

  // ─── DnD handlers ─────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    if (!sim.prepareMode) return;
    const activeRaw = String(active.id ?? "");
    const draggedMatch = activeRaw.match(/^sim-player-(?:bench-|list-)?(.+)$/);
    const draggedId = draggedMatch ? draggedMatch[1] : activeRaw.replace(/^sim-player-/, "");
    if (!over) return;

    const overId = over.id as string;

    if (overId.startsWith("sim-slot-")) {
      const targetSlotIndex = parseInt(overId.replace("sim-slot-", ""));
      // Find if player was already in a preview slot
      const fromEntry = Object.entries(sim.prepareSlotsPreview).find(
        ([, pid]) => pid === draggedId,
      );
      const fromSlotIndex = fromEntry ? parseInt(fromEntry[0]) : null;
      // Prevent bench player (fromSlotIndex=null) dropping on an empty preview slot:
      // that would add an extra player to the field without removing one.
      if (fromSlotIndex === null && (sim.prepareSlotsPreview[targetSlotIndex] ?? null) === null) {
        return;
      }
      sim.movePreparePlayer(draggedId, fromSlotIndex, targetSlotIndex);
    } else if (overId === "sim-bench") {
      const fromEntry = Object.entries(sim.prepareSlotsPreview).find(
        ([, pid]) => pid === draggedId,
      );
      if (fromEntry) {
        sim.movePreparePlayerToBench(draggedId, parseInt(fromEntry[0]));
      }
    }
  }

  // ─── Save / Load / Delete handlers ────────────────────────────────────────

  function handleSave(name: string) {
    if (!teamId || !eventId) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const saved = sim.toMatchSimulation(id, name, teamId, eventId, formationId);
    saveSimulation(saved);
    refreshSavedSims();
  }

  function handleLoad(savedSim: MatchSimulation) {
    setFormationId(savedSim.formationId);
    sim.loadSimulation(savedSim);
  }

  function handleDelete(id: string) {
    if (!teamId || !eventId) return;
    deleteSimulation(teamId, eventId, id);
    refreshSavedSims();
  }

  // ─── Active drag player ───────────────────────────────────────────────────

  const activeDragPlayer = activeDragId
    ? (() => {
        const m = String(activeDragId).match(/^sim-player-(?:bench-|list-)?(.+)$/);
        const pid = m ? m[1] : String(activeDragId).replace(/^sim-player-/, "");
        return playersById[pid];
      })()
    : null;

  // ─── Render guards ────────────────────────────────────────────────────────

  if (!eventId) {
    return (
      <div className={styles.center}>
        <EmptyState description="No se encontró el partido en el sistema interno. Asegúrate de que el evento esté creado en el área de Partidos del equipo." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <CircularProgress size={32} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.center}>
        <EmptyState description="Error cargando los datos. Inténtalo de nuevo." />
      </div>
    );
  }

  if (!sim.initialized || slotDefs.length === 0) {
    return (
      <div className={styles.center}>
        <EmptyState description="Guarda primero la alineación en la pestaña 'Alineación' para poder simular el partido." />
      </div>
    );
  }

  // ─── Field + compact bench content (shared between prepare/normal mode) ───
  // The side panel is now a compact, draggable bench (same visual language as
  // the on-field cards) in every viewport size — no more tablet-only layout.
  // The rich, read-only info panels ("En el campo" / "Banquillo") live in a
  // separate always-visible block below (see infoLists).

  const currentBenchPlayers = sim.prepareMode ? prepareBenchPlayers : benchPlayers;

  const fieldAndPanel = (
    <div className={styles.main}>
      <SimulationField
        slotDefs={slotDefs}
        slots={sim.slots}
        prepareSlotsPreview={sim.prepareMode ? sim.prepareSlotsPreview : undefined}
        playersById={playersById}
        playerMinutes={sim.playerMinutes}
        prepareMode={sim.prepareMode}
      />

      {/* Right column: compact bench + history */}
      <div className={styles.rightColumn}>
        <div className={styles.sidePanel}>
          <div className={styles.panelHeader}>
            {sim.prepareMode ? "Disponibles para el cambio" : "Banquillo"}
            <span className={styles.panelBadge}>{currentBenchPlayers.length}</span>
          </div>

          {currentBenchPlayers.length === 0 ? (
            <p className={styles.emptyBench}>
              {sim.prepareMode ? "Todos los jugadores están en el campo" : "No hay jugadores en el banquillo"}
            </p>
          ) : sim.prepareMode ? (
            <DroppableBench>
              <div className={styles.compactBenchItems}>
                {currentBenchPlayers.map((p) => (
                  <DraggableCompactBenchCard
                    key={p.id}
                    player={p}
                    isLeaving={leavingIds.has(p.id)}
                    minutesPlayed={sim.playerMinutes[p.id] ?? 0}
                  />
                ))}
              </div>
            </DroppableBench>
          ) : (
            <div className={styles.compactBenchItems}>
              {currentBenchPlayers.map((p) => (
                <CompactBenchCard
                  key={p.id}
                  player={p}
                  isLeaving={false}
                  minutesPlayed={sim.playerMinutes[p.id] ?? 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Substitution history */}
        <SubstitutionHistoryPanel windows={sim.windows} playersById={playersById} />
      </div>
    </div>
  );

  // ─── Info lists: rich, read-only "En el campo" + "Banquillo" — always
  // visible, every viewport size, full width, below field + compact bench ──

  const infoLists = (
    <div className={styles.infoListsRow}>
      <div className={styles.onFieldPanel}>
        <div className={styles.panelHeader}>
          En el campo
          <span className={styles.panelBadge}>{onFieldPlayers.length}</span>
        </div>
        <div className={styles.benchZoneStatic}>
          {onFieldPlayers.length === 0 ? (
            <p className={styles.emptyBench}>No hay jugadores en el campo</p>
          ) : (
            <div className={styles.benchPosGroupItems}>
              {groupBenchPlayers(onFieldPlayers).map((group) => (
                <Fragment key={group.label}>
                  <div className={styles.benchGroupSeparator} style={{ borderLeftColor: group.color }}>
                    <span className={styles.benchGroupSeparatorLabel}>{group.label}</span>
                    <span className={styles.benchGroupSeparatorCount}>{group.players.length}</span>
                  </div>
                  {group.players.map((p) => (
                    <BenchPlayerCard
                      key={p.id}
                      player={p}
                      isDragActive={false}
                      isLeaving={false}
                      minutesPlayed={sim.playerMinutes[p.id] ?? 0}
                      hasPlayed={(sim.playerStates[p.id]?.accumulatedMinutes ?? 0) > 0 || sim.playerStates[p.id]?.isOnField === true}
                      groupColor={group.color}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.benchInfoPanel}>
        <div className={styles.panelHeader}>
          Banquillo
          <span className={styles.panelBadge}>{currentBenchPlayers.length}</span>
        </div>
        <div className={styles.panelLegend}>
          <span className={styles.legendItem}>
            <span className={`${styles.benchCompTag} ${styles.benchCompMid}`} style={{ fontSize: "0.5rem" }}>Comp.</span> Competitividad
          </span>
          <span className={styles.legendItem}>
            <span className={styles.benchMinTag} style={{ fontSize: "0.5rem" }}>0&apos;</span> Minutos
          </span>
          <span className={styles.legendItem}>
            <span className={styles.benchStreakBadge} style={{ fontSize: "0.5rem" }}>⏱ N</span> Jornadas sin decisión técnica
          </span>
          <PlayerFormLegend />
        </div>
        <div className={styles.benchZoneStatic}>
          {currentBenchPlayers.length === 0 ? (
            <p className={styles.emptyBench}>No hay jugadores en el banquillo</p>
          ) : (
            <div className={styles.benchPosGroupItems}>
              {groupBenchPlayers(currentBenchPlayers).map((group) => (
                <Fragment key={group.label}>
                  <div className={styles.benchGroupSeparator} style={{ borderLeftColor: group.color }}>
                    <span className={styles.benchGroupSeparatorLabel}>{group.label}</span>
                    <span className={styles.benchGroupSeparatorCount}>{group.players.length}</span>
                  </div>
                  {group.players.map((p) => (
                    <BenchPlayerCard
                      key={p.id}
                      player={p}
                      isDragActive={false}
                      isLeaving={sim.prepareMode && leavingIds.has(p.id)}
                      minutesPlayed={sim.playerMinutes[p.id] ?? 0}
                      hasPlayed={(sim.playerStates[p.id]?.accumulatedMinutes ?? 0) > 0 || sim.playerStates[p.id]?.isOnField === true}
                      groupColor={group.color}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      {/* Timer + window tracker bar */}
      <div className={styles.topBar}>
        <MatchTimer
          currentMinute={sim.currentMinute}
          currentSecond={sim.currentSecond}
          isRunning={sim.isRunning}
          half={sim.half}
          isHalftime={sim.isHalftime}
          halfDuration={sim.halfDuration}
          onStart={sim.start}
          onStop={sim.stop}
          onReset={sim.reset}
          onAdvance={sim.advanceBy}
          onJumpTo={sim.jumpToMinute}
          onHalftime={() => { sim.stop(); sim.startHalftime(); sim.jumpToMinute(sim.halfDuration); }}
          onSecondHalf={() => { sim.stop(); sim.startSecondHalf(); sim.jumpToMinute(sim.halfDuration); }}
        />
        <SubstitutionWindowTracker
          windowsTotal={sim.windowsTotal}
          windowsInSecondHalf={sim.windowsInSecondHalf}
          canOpenWindow={sim.canOpenWindow}
          half={sim.half}
          prepareMode={sim.prepareMode}
          unlimitedWindows={isFriendly}
          onPrepare={sim.startPrepare}
          onCancel={sim.cancelPrepare}
          onCommit={sim.commitWindow}
        />
        <SimulationConfig
          halfDuration={sim.halfDuration}
          onHalfDurationChange={handleHalfDurationChange}
        />
      </div>

      {/* Rating bar */}
      {(fieldCompAvg !== null || benchCompAvg !== null) && (
        <div className={styles.ratingBar}>
          <span className={styles.ratingBarLabel}>Media competitividad:</span>
          {fieldCompAvg !== null && (
            <span
              className={`${styles.ratingBarItem} ${
                fieldCompAvg >= 8
                  ? styles.ratingBarHigh
                  : fieldCompAvg >= 6
                    ? styles.ratingBarMid
                    : styles.ratingBarLow
              }`}
            >
              ★ {Math.round(fieldCompAvg)} campo
            </span>
          )}
          {benchCompAvg !== null && (
            <span className={`${styles.ratingBarItem} ${styles.ratingBarBench}`}>
              ★ {Math.round(benchCompAvg)} banquillo
            </span>
          )}
        </div>
      )}

      {/* Field + bench — always inside DndContext so useDroppable/useDraggable hooks work */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {fieldAndPanel}
        <DragOverlay>
          {activeDragPlayer && (
            <div className={styles.dragOverlay}>
              {activeDragPlayer.photoSrc ? (
                <img
                  src={activeDragPlayer.photoSrc}
                  alt={activeDragPlayer.displayName}
                  className={styles.dragOverlayPhoto}
                />
              ) : (
                <span className={styles.dragOverlayInitials}>
                  {activeDragPlayer.displayName
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0] ?? "")
                    .join("")
                    .toUpperCase()}
                </span>
              )}
              <span className={styles.dragOverlayName}>
                {activeDragPlayer.alias?.trim() ||
                  activeDragPlayer.displayName.split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Info lists: rich, read-only "En el campo" + "Banquillo" — always visible */}
      {infoLists}

      {/* History + saved simulations */}
      <div className={styles.bottom}>
        <SavedSimulationsPanel
          savedSimulations={savedSims}
          onSave={handleSave}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />
      </div>

      {/* Competitiveness report — shown at full time or when a save is loaded */}
      {(sim.isMatchOver || sim.isLoadedFromSave) && sim.windows.length > 0 && (
        <MatchCompetitivenessReport
          initialSlots={sim.initialSlots}
          windows={sim.windows}
          finalSlots={sim.slots}
          playersById={playersById}
          halfDuration={sim.halfDuration}
        />
      )}

      {/* Confirmation dialog after committing a window */}
      <Dialog
        open={sim.lastCommittedWindow !== null}
        onClose={sim.dismissConfirmation}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "0.95rem", fontWeight: 700, display: "flex", gap: 1 }}>
          <SwapHorizIcon sx={{ fontSize: 20 }} />
          Ventana #{sim.lastCommittedWindow?.windowIndex} — min{" "}
          {sim.lastCommittedWindow?.minute}
        </DialogTitle>
        <DialogContent>
          <div className={styles.confirmSwapList}>
            {sim.lastCommittedWindow?.swaps.map((swap, i) => {
              const inP = playersById[swap.inPlayerId];
              const outP = swap.outPlayerId ? playersById[swap.outPlayerId] : null;
              const inName = inP
                ? (inP.alias?.trim() || inP.displayName.split(" ").slice(0, 2).join(" "))
                : swap.inPlayerId;
              const outName = outP
                ? (outP.alias?.trim() || outP.displayName.split(" ").slice(0, 2).join(" "))
                : "—";
              return (
                <div key={i} className={styles.confirmSwap}>
                  <span className={styles.swapIn}>▲ {inName}</span>
                  <span className={styles.swapSep}>por</span>
                  <span className={styles.swapOut}>▼ {outName}</span>
                </div>
              );
            })}
          </div>
          <p className={styles.confirmHint}>Cierra este diálogo para reanudar el cronómetro.</p>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={sim.dismissConfirmation}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
