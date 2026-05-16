import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import { FORMATION_POSITIONS, type FormationSlotDef } from "../../../types/formation";
import { useEvaluationPool } from "../evaluation/hooks/useEvaluationPool";
import { useMatchSimulation } from "../../convocations/hooks/useMatchSimulation";
import MatchTimer from "../../convocations/components/simulation/MatchTimer";
import SimulationField from "../../convocations/components/simulation/SimulationField";
import SubstitutionHistoryPanel from "../../convocations/components/simulation/SubstitutionHistoryPanel";
import SubstitutionWindowTracker from "../../convocations/components/simulation/SubstitutionWindowTracker";
import type { SimSlotPlayer } from "../../convocations/components/simulation/SimulationPlayerSlot";
import styles from "../../convocations/components/SimulacionTab.module.css";

const DEFAULT_FORMATION = "4-2-3-1";

type BenchPlayer = {
  id: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  competitiveness?: number | null;
};

const BENCH_POSITION_GROUPS: { label: string; color: string; test: (p: string) => boolean }[] = [
  { label: "Porteros", color: "#f59e0b", test: (p) => p.includes("portero") || p.includes("keeper") || p.includes("arquero") },
  { label: "Defensas", color: "#3b82f6", test: (p) => p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero") || p.includes("stopper") },
  { label: "Centrocampistas", color: "#10b981", test: (p) => p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante") },
  { label: "Delanteros", color: "#ef4444", test: (p) => p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger") },
];

function positionRank(pos?: string | null): number {
  const value = (pos ?? "").toLowerCase();
  if (value.includes("portero") || value.includes("keeper") || value.includes("arquero")) return 0;
  if (value.includes("defensa") || value.includes("central") || value.includes("lateral") || value.includes("libero") || value.includes("stopper")) return 1;
  if (value.includes("centrocampista") || value.includes("medio") || value.includes("pivote") || value.includes("interior") || value.includes("volante")) return 2;
  if (value.includes("delantero") || value.includes("extremo") || value.includes("punta") || value.includes("ariete") || value.includes("winger")) return 3;
  return 99;
}

  function isDiscardedRecruitmentStatus(status?: string | null) {
    return status?.trim().toLowerCase() === "descartado";
  }

  function isDiscardedPlayer(player: { recruitmentStatus?: string | null; assignment?: string | null }) {
    return isDiscardedRecruitmentStatus(player.recruitmentStatus) || player.assignment?.trim().toLowerCase() === "discard";
  }

function groupBenchPlayers(players: BenchPlayer[]) {
  const groups = BENCH_POSITION_GROUPS.map((group) => ({ ...group, players: [] as BenchPlayer[] }));
  const others: BenchPlayer[] = [];

  for (const player of players) {
    const lower = (player.position ?? "").toLowerCase();
    const idx = BENCH_POSITION_GROUPS.findIndex((group) => group.test(lower));
    if (idx >= 0) groups[idx].players.push(player);
    else others.push(player);
  }

  if (others.length > 0) groups.push({ label: "Sin posición", color: "#6b7280", players: others, test: () => false });
  return groups.filter((group) => group.players.length > 0);
}

function buildSlotMap(players: BenchPlayer[], slotDefs: FormationSlotDef[]) {
  const orderedPlayers = [...players].sort((a, b) => {
    const rankDiff = positionRank(a.position) - positionRank(b.position);
    if (rankDiff !== 0) return rankDiff;
    const nameDiff = a.displayName.localeCompare(b.displayName, "es");
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id);
  });

  const slotMap: Record<number, string | null> = {};
  slotDefs.forEach((slot, index) => {
    slotMap[slot.slotIndex] = orderedPlayers[index]?.id ?? null;
  });
  return slotMap;
}

function toBenchPlayer(player: { uniqueId: string; name: string; position?: string | null; jerseyNumber?: string | null; photoUrl?: string | null; rating?: { competitiveness?: number | null } | null; }): BenchPlayer {
  const dorsal = player.jerseyNumber && player.jerseyNumber.trim() !== "" && !Number.isNaN(Number(player.jerseyNumber))
    ? Number(player.jerseyNumber)
    : null;

  return {
    id: player.uniqueId,
    displayName: player.name,
    alias: player.name,
    photoSrc: player.photoUrl ?? null,
    dorsal,
    position: player.position ?? null,
    competitiveness: player.rating?.competitiveness ?? null,
  };
}

function BenchPlayerCard({
  player,
  isDragActive,
  isLeaving,
  minutesPlayed,
  hasPlayed,
  groupColor,
}: {
  player: BenchPlayer;
  isDragActive: boolean;
  isLeaving: boolean;
  minutesPlayed?: number;
  hasPlayed?: boolean;
  groupColor?: string;
}) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      className={`${styles.benchCard} ${isDragActive ? styles.benchCardDragging : ""} ${isLeaving ? styles.benchCardLeaving : ""}`}
      style={groupColor && !isLeaving ? { borderLeftColor: groupColor, borderLeftWidth: 3 } : undefined}
      title={player.displayName}
    >
      <div className={styles.benchCardTopRow}>
        <div className={styles.benchCardInfo}>
          <div className={styles.benchCardNameRow}>
            {player.dorsal != null && <span className={styles.benchCardDorsal}>{player.dorsal}</span>}
            <span className={styles.benchCardName}>{player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ")}</span>
          </div>
          {player.position && <div className={styles.benchCardPosition}>{player.position}</div>}
        </div>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={player.displayName} className={styles.benchCardAvatar} />
        ) : (
          <div className={styles.benchCardInitials}>{initials}</div>
        )}
      </div>

      <div className={styles.benchCardBottomRow}>
        <div className={styles.benchCardMetaRow}>
          {player.competitiveness != null && (
            <span
              className={`${styles.benchCompTag} ${
                player.competitiveness >= 8
                  ? styles.benchCompHigh
                  : player.competitiveness >= 6
                    ? styles.benchCompMid
                    : styles.benchCompLow
              }`}
            >
              Comp.&nbsp;{Math.round(player.competitiveness)}
            </span>
          )}
        </div>
        {!isLeaving ? (
          hasPlayed ? <span className={styles.benchMinTag}>{minutesPlayed}&apos;</span> : <span className={styles.benchNoPlayTag}>—</span>
        ) : (
          <span className={styles.benchCardSaleBadge}>SALE</span>
        )}
      </div>
    </div>
  );
}

function DraggableBenchCard({
  player,
  isLeaving,
  minutesPlayed,
  hasPlayed,
  groupColor,
}: {
  player: BenchPlayer;
  isLeaving: boolean;
  minutesPlayed?: number;
  hasPlayed?: boolean;
  groupColor?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sim-player-${player.id}`,
  });
  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={styles.benchDragHandle}>
      <BenchPlayerCard
        player={player}
        isDragActive={isDragging}
        isLeaving={isLeaving}
        minutesPlayed={minutesPlayed}
        hasPlayed={hasPlayed}
        groupColor={groupColor}
      />
    </div>
  );
}

function DroppableBench({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "sim-bench" });

  return (
    <div ref={setNodeRef} className={`${styles.benchZone} ${isOver ? styles.benchZoneOver : ""}`}>
      {children}
    </div>
  );
}

export default function SeasonPrepSimulationPage() {
  const navigate = useNavigate();
  const { pool, loading } = useEvaluationPool();
  const sim = useMatchSimulation({
    initialHalfDuration: 60,
    enableHalves: false,
    enableWindowLimits: false,
  });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const eligiblePlayers = useMemo(
     () => pool.filter((player) => !isDiscardedPlayer(player)),
    [pool],
  );

  const rosterPlayers = useMemo(() => eligiblePlayers.map(toBenchPlayer), [eligiblePlayers]);

  const slotDefs = useMemo(
    () => FORMATION_POSITIONS[DEFAULT_FORMATION] ?? [],
    [],
  );

  const playersById = useMemo<Record<string, SimSlotPlayer>>(
    () => Object.fromEntries(rosterPlayers.map((player) => [
      player.id,
      {
        teamPlayerId: player.id,
        displayName: player.displayName,
        alias: player.alias,
        photoSrc: player.photoSrc,
        dorsal: player.dorsal,
        competitiveness: player.competitiveness,
      },
    ])),
    [rosterPlayers],
  );

  const initialSlots = useMemo(() => buildSlotMap(rosterPlayers, slotDefs), [rosterPlayers, slotDefs]);

  useEffect(() => {
    if (loading || rosterPlayers.length === 0 || sim.initialized) return;
    sim.initSimulation(initialSlots);
  }, [loading, rosterPlayers.length, sim.initialized, sim.initSimulation, initialSlots]);

  const activeSlots = sim.prepareMode ? sim.prepareSlotsPreview : sim.slots;

  const benchPlayers = useMemo(() => {
    const onFieldIds = new Set(Object.values(activeSlots).filter(Boolean) as string[]);
    return rosterPlayers.filter((player) => !onFieldIds.has(player.id));
  }, [activeSlots, rosterPlayers]);

  const leavingIds = useMemo(() => {
    if (!sim.prepareMode) return new Set<string>();
    const realOnField = new Set(Object.values(sim.slots).filter(Boolean) as string[]);
    const previewOnField = new Set(Object.values(sim.prepareSlotsPreview).filter(Boolean) as string[]);
    const leaving = new Set<string>();
    for (const playerId of realOnField) {
      if (!previewOnField.has(playerId)) leaving.add(playerId);
    }
    return leaving;
  }, [sim.prepareMode, sim.slots, sim.prepareSlotsPreview]);

  const prepareBenchPlayers = useMemo(() => {
    if (!sim.prepareMode) return benchPlayers;
    const onPreviewField = new Set(Object.values(sim.prepareSlotsPreview).filter(Boolean) as string[]);
    return rosterPlayers.filter((player) => !onPreviewField.has(player.id));
  }, [benchPlayers, rosterPlayers, sim.prepareMode, sim.prepareSlotsPreview]);

  const activeDragPlayer = activeDragId ? playersById[activeDragId.replace("sim-player-", "")] : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    if (!sim.prepareMode) return;

    const draggedId = (active.id as string).replace("sim-player-", "");
    if (!over) return;

    const overId = over.id as string;
    if (overId.startsWith("sim-slot-")) {
      const targetSlotIndex = parseInt(overId.replace("sim-slot-", ""), 10);
      const fromEntry = Object.entries(sim.prepareSlotsPreview).find(([, pid]) => pid === draggedId);
      const fromSlotIndex = fromEntry ? parseInt(fromEntry[0], 10) : null;
      if (fromSlotIndex === null && (sim.prepareSlotsPreview[targetSlotIndex] ?? null) === null) {
        return;
      }
      sim.movePreparePlayer(draggedId, fromSlotIndex, targetSlotIndex);
    } else if (overId === "sim-bench") {
      const fromEntry = Object.entries(sim.prepareSlotsPreview).find(([, pid]) => pid === draggedId);
      if (fromEntry) {
        sim.movePreparePlayerToBench(draggedId, parseInt(fromEntry[0], 10));
      }
    }
  }

  if (loading) {
    return (
      <BaseLayout hideFooterMenu>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress />
        </Box>
      </BaseLayout>
    );
  }

  if (eligiblePlayers.length === 0) {
    return (
      <BaseLayout hideFooterMenu>
        <ContentLayout
          title="Simulación de plantilla"
          actionBar={
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/coach/season-prep")}>
              Volver
            </Button>
          }
        >
          <Typography sx={{ opacity: 0.55, mt: 4, textAlign: "center" }}>
            No hay jugadores disponibles para simular.
          </Typography>
        </ContentLayout>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Simulación de plantilla"
        actionBar={
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Chip size="small" label={`${rosterPlayers.length} jugadores`} />
            <Chip size="small" label="Sesión continua · 60 min" />
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/coach/season-prep")}>
              Volver
            </Button>
          </Box>
        }
      >
        <div className={styles.root}>
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
              onHalftime={() => {}}
              onSecondHalf={() => {}}
              showPhaseBadge={false}
              showHalfControls={false}
            />
            <SubstitutionWindowTracker
              windowsTotal={sim.windowsTotal}
              windowsInSecondHalf={sim.windowsInSecondHalf}
              canOpenWindow={sim.canOpenWindow}
              half={sim.half}
              prepareMode={sim.prepareMode}
              showCounters={false}
              unlimitedWindows
              onPrepare={sim.startPrepare}
              onCancel={sim.cancelPrepare}
              onCommit={sim.commitWindow}
            />
          </div>

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className={styles.main}>
              <SimulationField
                slotDefs={slotDefs}
                slots={sim.slots}
                prepareSlotsPreview={sim.prepareMode ? sim.prepareSlotsPreview : undefined}
                playersById={playersById}
                playerMinutes={sim.playerMinutes}
                prepareMode={sim.prepareMode}
              />

              <div className={styles.rightColumn}>
                <div className={styles.sidePanel}>
                  <div className={styles.panelHeader}>
                    {sim.prepareMode ? "Disponibles para el cambio" : "Banquillo"}
                    <span className={styles.panelBadge}>{sim.prepareMode ? prepareBenchPlayers.length : benchPlayers.length}</span>
                  </div>

                  {sim.prepareMode ? (
                    <DroppableBench>
                      {prepareBenchPlayers.length === 0 ? (
                        <p className={styles.emptyBench}>Todos los jugadores están en el campo</p>
                      ) : (
                        <div className={styles.benchPosGroupItems}>
                          {groupBenchPlayers(prepareBenchPlayers).map((group) => (
                            <Fragment key={group.label}>
                              <div className={styles.benchGroupSeparator} style={{ borderLeftColor: group.color }}>
                                <span className={styles.benchGroupSeparatorLabel}>{group.label}</span>
                                <span className={styles.benchGroupSeparatorCount}>{group.players.length}</span>
                              </div>
                              {group.players.map((player) => (
                                <DraggableBenchCard
                                  key={player.id}
                                  player={player}
                                  isLeaving={leavingIds.has(player.id)}
                                  minutesPlayed={sim.playerMinutes[player.id] ?? 0}
                                  hasPlayed={(sim.playerStates[player.id]?.accumulatedMinutes ?? 0) > 0 || sim.playerStates[player.id]?.isOnField === true}
                                  groupColor={group.color}
                                />
                              ))}
                            </Fragment>
                          ))}
                        </div>
                      )}
                    </DroppableBench>
                  ) : (
                    <>
                      <div className={styles.panelLegend}>
                        <span className={styles.legendItem}>
                          <span className={`${styles.benchCompTag} ${styles.benchCompMid}`} style={{ fontSize: "0.5rem" }}>Comp.</span> Competitividad
                        </span>
                        <span className={styles.legendItem}>
                          <span className={styles.benchMinTag} style={{ fontSize: "0.5rem" }}>0&apos;</span> Minutos
                        </span>
                      </div>
                      <div className={styles.benchZoneStatic}>
                        {benchPlayers.length === 0 ? (
                          <p className={styles.emptyBench}>No hay jugadores en el banquillo</p>
                        ) : (
                          <div className={styles.benchPosGroupItems}>
                            {groupBenchPlayers(benchPlayers).map((group) => (
                              <Fragment key={group.label}>
                                <div className={styles.benchGroupSeparator} style={{ borderLeftColor: group.color }}>
                                  <span className={styles.benchGroupSeparatorLabel}>{group.label}</span>
                                  <span className={styles.benchGroupSeparatorCount}>{group.players.length}</span>
                                </div>
                                {group.players.map((player) => (
                                  <BenchPlayerCard
                                    key={player.id}
                                    player={player}
                                    isDragActive={false}
                                    isLeaving={false}
                                    minutesPlayed={sim.playerMinutes[player.id] ?? 0}
                                    hasPlayed={(sim.playerStates[player.id]?.accumulatedMinutes ?? 0) > 0}
                                    groupColor={group.color}
                                  />
                                ))}
                              </Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <SubstitutionHistoryPanel windows={sim.windows} playersById={playersById} phaseLabel="Sesión" />
              </div>
            </div>

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
                        .map((word) => word[0] ?? "")
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                  <span className={styles.dragOverlayName}>
                    {activeDragPlayer.alias?.trim() || activeDragPlayer.displayName.split(" ").slice(0, 2).join(" ")}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
