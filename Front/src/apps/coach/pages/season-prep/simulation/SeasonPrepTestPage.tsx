import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import SaveIcon from "@mui/icons-material/Save";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Typography,
} from "@mui/material";

import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import { FORMATION_POSITIONS, type FormationSlotDef } from "../../../types/formation";
import { useEvaluationPool } from "../evaluation/hooks/useEvaluationPool";
import { loadSeasonPrepSelection, saveSeasonPrepSelection } from "../seasonPrepSelectionStorage";
import SimulationField from "../../convocations/components/simulation/SimulationField";
import type { SimSlotPlayer } from "../../convocations/components/simulation/SimulationPlayerSlot";
import styles from "./SeasonPrepSimulationPage.module.css";
import simStyles from "../../convocations/components/SimulacionTab.module.css";
import {
  clearSeasonPrepTestSimulation,
  loadSeasonPrepTestSimulation,
  saveSeasonPrepTestSimulation,
  type SeasonPrepTestSimulationState,
} from "./seasonPrepTestSimulationService";

type TeamSide = "blue" | "red";

type BenchPlayer = {
  id: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  competitiveness?: number | null;
};

type RoutedPlayer = {
  uniqueId: string;
  name: string;
  position?: string | null;
  jerseyNumber?: string | null;
  photoUrl?: string | null;
  rating?: { competitiveness?: number | null } | null;
};

const DEFAULT_FORMATION = "4-2-3-1";

const TEAM_META: Record<TeamSide, { label: string; color: string; background: string }> = {
  blue: {
    label: "Azul",
    color: "#4d9de0",
    background: "linear-gradient(160deg, rgba(77,157,224,0.22) 0%, rgba(10,18,31,0.96) 100%)",
  },
  red: {
    label: "Rojo",
    color: "#ef4444",
    background: "linear-gradient(160deg, rgba(239,68,68,0.22) 0%, rgba(10,18,31,0.96) 100%)",
  },
};

function isDiscardedRecruitmentStatus(status?: string | null) {
  const normalized = status?.trim().toLowerCase() ?? "";
  return normalized.includes("descart") || normalized.includes("descat");
}

function isDiscardedPlayer(player: { recruitmentStatus?: string | null; assignment?: string | null }) {
  return isDiscardedRecruitmentStatus(player.recruitmentStatus) || player.assignment?.trim().toLowerCase() === "discard";
}

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

function mirrorSlotDefs(slotDefs: FormationSlotDef[]): FormationSlotDef[] {
  return slotDefs.map((slot) => ({ ...slot, x: 100 - slot.x }));
}

function sortPlayers(players: BenchPlayer[]): BenchPlayer[] {
  return [...players].sort((a, b) => {
    const rankDiff = positionRank(a.position) - positionRank(b.position);
    if (rankDiff !== 0) return rankDiff;
    const compDiff = (b.competitiveness ?? -1) - (a.competitiveness ?? -1);
    if (compDiff !== 0) return compDiff;
    const nameDiff = a.displayName.localeCompare(b.displayName, "es");
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id);
  });
}

function createEmptySlotMap(slotDefs: FormationSlotDef[]): Record<number, string | null> {
  return Object.fromEntries(slotDefs.map((slot) => [slot.slotIndex, null])) as Record<number, string | null>;
}

function createInitialState(players: BenchPlayer[], slotDefs: FormationSlotDef[]) {
  const sorted = sortPlayers(players);
  const blueSlots = createEmptySlotMap(slotDefs);
  const redSlots = createEmptySlotMap(slotDefs);

  slotDefs.forEach((slot, index) => {
    blueSlots[slot.slotIndex] = sorted[index]?.id ?? null;
    redSlots[slot.slotIndex] = sorted[index + slotDefs.length]?.id ?? null;
  });

  return { blueSlots, redSlots };
}

function toBenchPlayer(player: {
  uniqueId: string;
  name: string;
  position?: string | null;
  jerseyNumber?: string | null;
  photoUrl?: string | null;
  rating?: { competitiveness?: number | null } | null;
}): BenchPlayer {
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
  isDragging,
  teamLabel,
}: {
  player: BenchPlayer;
  isDragging: boolean;
  teamLabel?: string;
}) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className={`${simStyles.benchCard} ${isDragging ? simStyles.benchCardDragging : ""}`} title={player.displayName}>
      <div className={simStyles.benchCardTopRow}>
        <div className={simStyles.benchCardInfo}>
          <div className={simStyles.benchCardNameRow}>
            {player.dorsal != null && <span className={simStyles.benchCardDorsal}>{player.dorsal}</span>}
            <span className={simStyles.benchCardName}>{player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ")}</span>
          </div>
          {player.position && <div className={simStyles.benchCardPosition}>{player.position}</div>}
          {teamLabel && <div className={styles.teamTag}>{teamLabel}</div>}
        </div>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={player.displayName} className={simStyles.benchCardAvatar} />
        ) : (
          <div className={simStyles.benchCardInitials}>{initials}</div>
        )}
      </div>

      <div className={simStyles.benchCardBottomRow}>
        <div className={simStyles.benchCardMetaRow}>
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
              Comp.&nbsp;{Math.round(player.competitiveness)}
            </span>
          )}
        </div>
        <span className={simStyles.benchNoPlayTag}>BANQ</span>
      </div>
    </div>
  );
}

function DraggableBenchCard({ player, teamLabel }: { player: BenchPlayer; teamLabel?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sim-player-${player.id}`,
  });
  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={simStyles.benchDragHandle}>
      <BenchPlayerCard player={player} isDragging={isDragging} teamLabel={teamLabel} />
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

function TeamFieldCard({
  teamSide,
  slotDefs,
  slots,
  playersById,
  playerMinutes,
  prepareMode,
}: {
  teamSide: TeamSide;
  slotDefs: FormationSlotDef[];
  slots: Record<number, string | null>;
  playersById: Record<string, SimSlotPlayer>;
  playerMinutes: Record<string, number>;
  prepareMode: boolean;
}) {
  const meta = TEAM_META[teamSide];
  return (
    <div className={styles.teamCard} style={{ boxShadow: `0 0 0 1px ${meta.color}33 inset, 0 0 0 1px rgba(255,255,255,0.06)` }}>
      <div className={styles.teamHeader} style={{ borderColor: meta.color }}>
        <span className={styles.teamTitle} style={{ color: meta.color }}>{meta.label}</span>
        <span className={styles.teamSubtitle}>{prepareMode ? "Prepara la alineación" : "Alineación lista"}</span>
      </div>
      <div className={styles.teamFieldWrap}>
        <div className={styles.teamFieldFrame} style={{ background: meta.background }}>
          <SimulationField
            slotDefs={slotDefs}
            slots={slots}
            playersById={playersById}
            playerMinutes={playerMinutes}
            prepareMode={prepareMode}
            slotIdPrefix={teamSide}
          />
        </div>
      </div>
    </div>
  );
}

export default function SeasonPrepTestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as {
    players?: RoutedPlayer[];
    teamId?: string;
    teamName?: string;
    sportEventId?: string;
    sportEventName?: string;
  } | null) ?? null;
  const storedSelection = loadSeasonPrepSelection();
  const teamId = routeState?.teamId ?? storedSelection?.teamId ?? null;
  const teamName = routeState?.teamName ?? storedSelection?.teamName ?? null;
  const [selectedEventId] = useState<string | null>(routeState?.sportEventId ?? storedSelection?.sportEventId ?? null);
  const { pool, loading } = useEvaluationPool(selectedEventId);
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<{ blue: Record<number, string | null>; red: Record<number, string | null> }>({
    blue: {},
    red: {},
  });
  const [initialized, setInitialized] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const routedPlayers = routeState?.players ?? null;
  const selectedEventName = routeState?.sportEventName ?? storedSelection?.sportEventName ?? selectedEventId ?? "Selecciona evento";

  const fallbackPlayers = useMemo(
    () => pool.filter((player) => !isDiscardedPlayer(player)).map(toBenchPlayer),
    [pool],
  );

  const rosterPlayers = routedPlayers
    ? routedPlayers.filter((player) => !isDiscardedPlayer(player as RoutedPlayer & { recruitmentStatus?: string | null; assignment?: string | null })).map(toBenchPlayer)
    : fallbackPlayers;
  const slotDefs = useMemo(() => FORMATION_POSITIONS[DEFAULT_FORMATION] ?? [], []);
  const redSlotDefs = useMemo(() => mirrorSlotDefs(slotDefs), [slotDefs]);

  const playersById = useMemo<Record<string, SimSlotPlayer>>(
    () => Object.fromEntries(
      rosterPlayers.map((player) => [
        player.id,
        {
          teamPlayerId: player.id,
          displayName: player.displayName,
          alias: player.alias,
          photoSrc: player.photoSrc,
          dorsal: player.dorsal,
          competitiveness: player.competitiveness,
        },
      ]),
    ),
    [rosterPlayers],
  );

  const blueSlots = lineups.blue ?? createEmptySlotMap(slotDefs);
  const redSlots = lineups.red ?? createEmptySlotMap(slotDefs);

  useEffect(() => {
    if ((routedPlayers === null && loading) || rosterPlayers.length === 0 || initialized) return;

    const saved = loadSeasonPrepTestSimulation(selectedEventId);
    if (saved) {
      const allIds = new Set(rosterPlayers.map((player) => player.id));
      const normalise = (source?: Record<number, string | null> | null) => {
        const next = createEmptySlotMap(slotDefs);
        for (const [slotIndex, playerId] of Object.entries(source ?? {})) {
          next[Number(slotIndex)] = playerId && allIds.has(playerId) ? playerId : null;
        }
        return next;
      };

      setLineups({
        blue: normalise(saved.blueSlots),
        red: normalise(saved.redSlots),
      });
      setStarted(saved.started);
    } else {
      const initial = createInitialState(rosterPlayers, slotDefs);
      setLineups({
        blue: initial.blueSlots,
        red: initial.redSlots,
      });
    }

    setInitialized(true);
  }, [initialized, loading, rosterPlayers, routedPlayers, selectedEventId, slotDefs]);

  useEffect(() => {
    if (!teamId) return;
    saveSeasonPrepSelection({
      teamId,
      teamName,
      sportEventId: selectedEventId,
      sportEventName: selectedEventName,
    });
  }, [selectedEventId, selectedEventName, teamId, teamName]);

  const benchPlayers = useMemo(() => {
    const usedIds = new Set([
      ...Object.values(blueSlots).filter(Boolean) as string[],
      ...Object.values(redSlots).filter(Boolean) as string[],
    ]);
    return rosterPlayers.filter((player) => !usedIds.has(player.id));
  }, [blueSlots, redSlots, rosterPlayers]);

  const currentDragPlayer = activeDragId ? playersById[activeDragId.replace("sim-player-", "")] : null;

  function findLocation(playerId: string) {
    const blueEntry = Object.entries(lineups.blue).find(([, pid]) => pid === playerId);
    if (blueEntry) return { team: "blue" as const, slotIndex: Number(blueEntry[0]) };
    const redEntry = Object.entries(lineups.red).find(([, pid]) => pid === playerId);
    if (redEntry) return { team: "red" as const, slotIndex: Number(redEntry[0]) };
    return null;
  }

  function updateLineups(mutator: (draft: { blue: Record<number, string | null>; red: Record<number, string | null> }) => void) {
    setLineups((prev) => {
      const next = {
        blue: { ...prev.blue },
        red: { ...prev.red },
      };
      mutator(next);
      return next;
    });
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    if (!over) return;

    const draggedId = (active.id as string).replace("sim-player-", "");
    const source = findLocation(draggedId);
    const overId = over.id as string;

    if (overId === "sim-bench") {
      if (!source) return;
      updateLineups((draft) => {
        draft[source.team][source.slotIndex] = null;
      });
      return;
    }

    const slotMatch = overId.match(/^sim-slot-(blue|red)-(\d+)$/);
    if (!slotMatch) return;

    const targetTeam = slotMatch[1] as TeamSide;
    const targetSlotIndex = Number(slotMatch[2]);

    updateLineups((draft) => {
      const targetMap = draft[targetTeam];
      const targetOccupant = targetMap[targetSlotIndex] ?? null;

      if (source) {
        const sourceMap = draft[source.team];
        sourceMap[source.slotIndex] = targetOccupant;
        if (source.team === targetTeam && source.slotIndex === targetSlotIndex) return;
      }

      targetMap[targetSlotIndex] = draggedId;
    });
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      saveSeasonPrepTestSimulation({
        version: 1,
        sportEventId: selectedEventId,
        blueSlots: lineups.blue,
        redSlots: lineups.red,
        started,
        updatedAt: new Date().toISOString(),
      }, selectedEventId);
      setSnackbar({ open: true, message: "Cambios guardados", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "No se pudieron guardar los cambios", severity: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const initial = createInitialState(rosterPlayers, slotDefs);
    setLineups(initial);
    setStarted(false);
    clearSeasonPrepTestSimulation(selectedEventId);
    setSnackbar({ open: true, message: "Alineaciones restablecidas", severity: "success" });
  }

  if (routedPlayers === null && loading) {
    return (
      <BaseLayout hideFooterMenu>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress />
        </Box>
      </BaseLayout>
    );
  }

  if (rosterPlayers.length === 0) {
    return (
      <BaseLayout hideFooterMenu>
        <ContentLayout
          title="Simulación para pruebas"
          actionBar={
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/coach/season-prep/evaluate", { state: { teamId, teamName, sportEventId: selectedEventId, sportEventName: selectedEventName } }) }>
              Volver
            </Button>
          }
        >
          <Typography sx={{ opacity: 0.55, mt: 4, textAlign: "center" }}>
            No hay jugadores elegidos para evaluar.
          </Typography>
        </ContentLayout>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Simulación para pruebas"
        actionBar={
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Chip size="small" color={selectedEventId ? "primary" : "warning"} label={selectedEventName} />
            <Chip size="small" label={`${rosterPlayers.length} jugadores evaluables`} />
            <Chip size="small" label={started ? "Pruebas iniciadas" : "Preparación"} color={started ? "success" : "default"} />
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/coach/season-prep/evaluate", { state: { teamId: routeState?.teamId, teamName: routeState?.teamName, sportEventId: selectedEventId, sportEventName: routeState?.sportEventName } }) }>
              Volver
            </Button>
            <Button size="small" variant="outlined" startIcon={<AutorenewIcon />} onClick={handleReset}>
              Reiniciar
            </Button>
            <Button size="small" variant="contained" startIcon={<SaveIcon />} disabled={saving} onClick={handleSave}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={() => setStarted((prev) => !prev)}>
              {started ? "Detener" : "Iniciar pruebas"}
            </Button>
          </Box>
        }
      >
        <div className={styles.root}>
          <div className={styles.noticeRow}>
            <Chip size="small" label="Azul y Rojo" sx={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
            <span className={styles.noticeText}>
              Arrastra los jugadores evaluables a Azul o Rojo antes de guardar.
            </span>
          </div>

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} autoScroll>
            <div className={styles.teamsGrid}>
              <TeamFieldCard
                teamSide="blue"
                slotDefs={slotDefs}
                slots={blueSlots}
                playersById={playersById}
                playerMinutes={{}}
                prepareMode={!started}
              />
              <TeamFieldCard
                teamSide="red"
                slotDefs={redSlotDefs}
                slots={redSlots}
                playersById={playersById}
                playerMinutes={{}}
                prepareMode={!started}
              />
            </div>

            <div className={styles.benchPanel}>
              <div className={styles.benchHeader}>
                <span className={styles.benchTitle}>Banquillo</span>
                <span className={styles.benchCount}>{benchPlayers.length}</span>
              </div>
              <DroppableBench>
                {benchPlayers.length === 0 ? (
                  <p className={styles.emptyBench}>Todos los jugadores están ocupados en los dos equipos</p>
                ) : (
                  <div className={styles.benchGroups}>
                    {groupBenchPlayers(benchPlayers).map((group) => (
                      <div key={group.label} className={styles.benchGroupColumn}>
                        <div className={styles.benchGroupSeparator} style={{ borderLeftColor: group.color }}>
                          <span className={styles.benchGroupSeparatorLabel}>{group.label}</span>
                          <span className={styles.benchGroupSeparatorCount}>{group.players.length}</span>
                        </div>
                        <div className={styles.benchGroupCards}>
                          {group.players.map((player) => (
                            <DraggableBenchCard key={player.id} player={player} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DroppableBench>
            </div>

            <DragOverlay>
              {currentDragPlayer && (
                <div className={simStyles.dragOverlay}>
                  {currentDragPlayer.photoSrc ? (
                    <img src={currentDragPlayer.photoSrc} alt={currentDragPlayer.displayName} className={simStyles.dragOverlayPhoto} />
                  ) : (
                    <span className={simStyles.dragOverlayInitials}>
                      {currentDragPlayer.displayName
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0] ?? "")
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                  <span className={simStyles.dragOverlayName}>
                    {currentDragPlayer.alias?.trim() || currentDragPlayer.displayName.split(" ").slice(0, 2).join(" ")}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </ContentLayout>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </BaseLayout>
  );
}
