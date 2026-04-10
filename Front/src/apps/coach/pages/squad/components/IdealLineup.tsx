import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { getFormations } from "../../../services/formationService";
import { getIdealLineup, saveIdealLineup } from "../../../services/idealLineupService";
import { FORMATION_POSITIONS } from "../../../types/formation";
import type { Formation } from "../../../types/formation";
import FootballField from "./FootballField";
import styles from "./IdealLineup.module.css";

// ─── Position grouping helpers ──────────────────────────────────────────
const POSITION_GROUPS: { label: string; color: string; test: (pos: string) => boolean }[] = [
  {
    label: "Porteros",
    color: "#f59e0b",
    test: (p) => p.includes("portero") || p.includes("keeper") || p.includes("arquero"),
  },
  {
    label: "Defensas",
    color: "#3b82f6",
    test: (p) =>
      p.includes("defensa") || p.includes("central") || p.includes("lateral") ||
      p.includes("libero") || p.includes("stopper"),
  },
  {
    label: "Centrocampistas",
    color: "#10b981",
    test: (p) =>
      p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") ||
      p.includes("interior") || p.includes("volante"),
  },
  {
    label: "Delanteros",
    color: "#ef4444",
    test: (p) =>
      p.includes("delantero") || p.includes("extremo") || p.includes("punta") ||
      p.includes("ariete") || p.includes("winger"),
  },
];

function groupPlayersByPosition(players: SquadPlayer[]) {
  const groups: { label: string; color: string; players: SquadPlayer[] }[] = POSITION_GROUPS.map(
    (g) => ({ label: g.label, color: g.color, players: [] })
  );
  const others: SquadPlayer[] = [];

  for (const p of players) {
    const lower = (p.position ?? "").toLowerCase();
    const idx = POSITION_GROUPS.findIndex((g) => g.test(lower));
    if (idx >= 0) groups[idx].players.push(p);
    else others.push(p);
  }

  if (others.length > 0) groups.push({ label: "Sin posición", color: "#6b7280", players: others });

  const byCompDesc = (a: SquadPlayer, b: SquadPlayer) =>
    (b.competitiveness ?? -1) - (a.competitiveness ?? -1);

  return groups
    .filter((g) => g.players.length > 0)
    .map((g) => ({ ...g, players: [...g.players].sort(byCompDesc) }));
}

interface SquadPlayer {
  id: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  position?: string | null;
  competitiveness?: number | null;
  isInjured?: boolean;
}

export interface IdealLineupHandle {
  save(): Promise<void>;
}

interface IdealLineupProps {
  players: SquadPlayer[];
  teamId: string;
  seasonId?: string | null;
  panelTitle?: string;
  hideInternalSave?: boolean;
  onSavingChange?: (saving: boolean) => void;
}

// ─── Draggable list item ───────────────────────────────────────────────
function DraggableListItem({ player }: { player: SquadPlayer }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  });
  const style = { transform: CSS.Translate.toString(transform) };
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${styles.playerListItem} ${isDragging ? styles.dragging : ""}`}
    >
      {player.photoSrc ? (
        <img src={player.photoSrc} alt={player.displayName} className={styles.playerAvatar} />
      ) : (
        <div className={styles.playerAvatarInitials}>{initials}</div>
      )}
      <div className={styles.playerInfo}>
        <div className={styles.playerItemName}>{player.displayName}</div>
        {player.position && (
          <div className={styles.playerItemPosition}>{player.position}</div>
        )}
        {player.isInjured && (
          <div className={styles.injuredTag}>🩹 Lesionado</div>
        )}
      </div>
      {player.dorsal != null && (
        <span className={styles.playerDorsal}>{player.dorsal}</span>
      )}
      {player.competitiveness != null && (
        <span
          className={styles.playerCompetBadge}
          title="Competitividad"
        >
          Com. {Math.round(player.competitiveness)}
        </span>
      )}
    </div>
  );
}

function OverlayItem({ player }: { player: SquadPlayer }) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className={styles.dragOverlay}>
      {player.photoSrc ? (
        <img src={player.photoSrc} alt={player.displayName} className={styles.playerAvatar} />
      ) : (
        <div className={styles.playerAvatarInitials}>{initials}</div>
      )}
      <span className={styles.playerItemName}>{player.displayName}</span>
    </div>
  );
}

// ─── Main IdealLineup component ────────────────────────────────────────
const IdealLineup = forwardRef<IdealLineupHandle, IdealLineupProps>(function IdealLineup(
  { players, teamId, seasonId, panelTitle, hideInternalSave, onSavingChange },
  ref
) {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationId, setFormationId] = useState<string>("");
  const [slots, setSlots] = useState<Record<number, string | null>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const onSavingChangeRef = useRef(onSavingChange);
  onSavingChangeRef.current = onSavingChange;
  const [loadingLineup, setLoadingLineup] = useState(true);

  // ── Sensors (mouse + touch) ──────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // ── Load formations catalog ──────────────────────────────────────────
  useEffect(() => {
    getFormations().then((list) => {
      setFormations(list);
      if (list.length > 0 && !formationId) setFormationId(list[0].id);
    });
  }, []);

  // ── Load saved lineup on team/season change ──────────────────────────
  useEffect(() => {
    if (!teamId) { setLoadingLineup(false); return; }
    setLoadingLineup(true);
    getIdealLineup(teamId, seasonId)
      .then((lineup) => {
        if (!lineup) { setLoadingLineup(false); return; }
        setFormationId(lineup.formationId);
        const slotMap: Record<number, string | null> = {};
        lineup.slots.forEach((s) => { slotMap[s.slotIndex] = s.teamPlayerId; });
        setSlots(slotMap);
      })
      .catch(() => {})
      .finally(() => setLoadingLineup(false));
  }, [teamId, seasonId]);

  // ── Derived state ────────────────────────────────────────────────────
  const slottedIds = useMemo(
    () => new Set(Object.values(slots).filter(Boolean) as string[]),
    [slots]
  );

  const availablePlayers = useMemo(
    () => players.filter((p) => !slottedIds.has(p.id)),
    [players, slottedIds]
  );

  const groupedAvailable = useMemo(
    () => groupPlayersByPosition(availablePlayers),
    [availablePlayers]
  );

  const avgBenchComp = useMemo(() => {
    const rated = availablePlayers.filter((p) => p.competitiveness != null);
    if (rated.length === 0) return null;
    return rated.reduce((sum, p) => sum + (p.competitiveness ?? 0), 0) / rated.length;
  }, [availablePlayers]);

  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, {
      teamPlayerId: p.id,
      displayName: p.displayName,
      alias: p.alias,
      photoSrc: p.photoSrc,
      dorsal: p.dorsal,
      competitiveness: p.competitiveness,
      isInjured: p.isInjured,
    }])),
    [players]
  );

  const currentFormation = formations.find((f) => f.id === formationId);
  const slotDefs = currentFormation ? (FORMATION_POSITIONS[currentFormation.name] ?? []) : [];

  // ── DnD handlers ─────────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const draggedId = active.id as string;

    // Find if the dragged player was already in a slot
    const fromSlotEntry = Object.entries(slots).find(([, pid]) => pid === draggedId);
    const fromSlotIndex = fromSlotEntry ? parseInt(fromSlotEntry[0]) : null;

    const overId = over?.id?.toString() ?? null;
    if (!overId || !overId.startsWith("field-slot-")) {
      // Dropped outside — remove from slot if it was on the field
      if (fromSlotIndex !== null) {
        setSlots((prev) => { const next = { ...prev }; next[fromSlotIndex] = null; return next; });
      }
      return;
    }

    const targetSlotIndex = parseInt(overId.replace("field-slot-", ""));
    const existingPlayerId = slots[targetSlotIndex] ?? null;

    setSlots((prev) => {
      const next = { ...prev };
      next[targetSlotIndex] = draggedId;
      if (fromSlotIndex !== null && fromSlotIndex !== targetSlotIndex) {
        // Swap: put the displaced player where the dragged player came from
        next[fromSlotIndex] = existingPlayerId;
      }
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!formationId || !teamId) return;
    setSaving(true);
    onSavingChangeRef.current?.(true);
    try {
      const slotPayload = Object.entries(slots)
        .filter(([, pid]) => pid !== null && pid !== undefined)
        .map(([idx, pid]) => ({ slotIndex: parseInt(idx), teamPlayerId: pid as string }));

      await saveIdealLineup(teamId, { formationId, seasonId, slots: slotPayload });
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Alineación guardada", severity: "success" },
        })
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Error al guardar la alineación", severity: "error" },
        })
      );
    } finally {
      setSaving(false);
      onSavingChangeRef.current?.(false);
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }));

  const activePlayer = activeId ? (playersById[activeId] ?? null) : null;

  if (loadingLineup) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.root}>
        {/* Top bar: formation selector + save button */}
        <div className={styles.topBar}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Formación</InputLabel>
            <Select
              value={formationId}
              label="Formación"
              onChange={(e) => setFormationId(e.target.value as string)}
              disabled={formations.length === 0}
            >
              {formations.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {!hideInternalSave && (
            <Button
              variant="contained"
              size="small"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !formationId}
            >
              Guardar
            </Button>
          )}
        </div>

        {/* Field + player list */}
        <div className={styles.content}>
          <FootballField slotDefs={slotDefs} slots={slots} playersById={playersById} />

          {/* Available players */}
          <div className={styles.playerListPanel}>
            <div className={styles.panelHeader}>
              {panelTitle ?? "Jugadores disponibles"}
              <div className={styles.panelHeaderRight}>
                {avgBenchComp != null && (
                  <span className={styles.panelCompTag}>
                    Com. {avgBenchComp.toFixed(1)}
                  </span>
                )}
                <span className={styles.panelBadge}>{availablePlayers.length}</span>
              </div>
            </div>
            <div className={styles.playerList}>
              {availablePlayers.length === 0 ? (
                <Typography className={styles.emptyList}>
                  Todos los jugadores están en la alineación
                </Typography>
              ) : (
                groupedAvailable.map((group) => (
                  <div key={group.label} className={styles.positionGroup}>
                    <div className={styles.positionGroupHeader}>
                      <div
                        className={styles.positionGroupAccent}
                        style={{ background: group.color }}
                      />
                      <span className={styles.positionGroupLabel}>{group.label}</span>
                      <span className={styles.positionGroupCount}>{group.players.length}</span>
                    </div>
                    <div className={styles.positionGroupItems}>
                      {group.players.map((p) => (
                        <DraggableListItem key={p.id} player={p} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activePlayer && <OverlayItem player={activePlayer} />}
      </DragOverlay>
    </DndContext>
  );
});

export default IdealLineup;
