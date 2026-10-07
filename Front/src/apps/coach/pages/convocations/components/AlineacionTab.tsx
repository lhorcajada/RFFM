import { useImperativeHandle, useMemo, useState, type ReactNode, type RefObject } from "react";
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
import { CircularProgress, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { IdealLineupHandle, SquadPlayer } from "../../squad/components/IdealLineup";
import PlayerFormLegend from "../../../components/PlayerFormLegend/PlayerFormLegend";
import { useLineupEditor } from "../hooks/useLineupEditor";
import SimulationField from "./simulation/SimulationField";
import type { SimSlotPlayer } from "./simulation/SimulationPlayerSlot";
import { DroppableBench } from "./simulation/BenchPlayerCard";
import { CompactBenchCard, DraggableCompactBenchCard } from "./simulation/CompactBenchCard";
import liveStyles from "./PartidoEnDirectoTab.module.css";
import simStyles from "./SimulacionTab.module.css";
import styles from "./AlineacionTab.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  mgmtEventId: string | null;
  lineupPlayers: SquadPlayer[];
  notCalledPlayers?: SquadPlayer[];
  pendingPlayers?: SquadPlayer[];
  /** Accepted players who ended up not attending (excused or unexcused) — shown separately. */
  notAttendingPlayers?: SquadPlayer[];
  lineupRef: RefObject<IdealLineupHandle | null>;
  teamId: string;
  onSavingChange: (saving: boolean) => void;
  onDeconvoke?: (playerId: string) => void;
  onReconvoke?: (playerId: string) => void;
  onAcceptPending?: (playerId: string) => void;
};

function draggedPlayerId(activeId: string | number): string {
  const raw = String(activeId);
  const match = raw.match(/^sim-player-(?:bench-|list-)?(.+)$/);
  return match ? match[1] : raw;
}

function shortName(player: SquadPlayer): string {
  return player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ");
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Alineación previa al partido con la misma distribución que el partido en directo:
 *  campo con avatares a la izquierda y columna lateral (banquillo, pendientes,
 *  desconvocados, no asisten) a la derecha. */
export default function AlineacionTab({
  mgmtEventId,
  lineupPlayers,
  notCalledPlayers = [],
  pendingPlayers = [],
  notAttendingPlayers = [],
  lineupRef,
  teamId,
  onSavingChange,
  onDeconvoke,
  onReconvoke,
  onAcceptPending,
}: Props) {
  const lineup = useLineupEditor(teamId, mgmtEventId, onSavingChange);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  useImperativeHandle(lineupRef, () => ({ save: lineup.save }), [lineup.save]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

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
            formStatus: p.formStatus,
          },
        ]),
      ),
    [lineupPlayers],
  );

  // Titulares que ya no están disponibles (desconvocados tras guardar) no se pintan en el campo.
  const fieldSlots = useMemo(() => {
    const result: Record<number, string | null> = {};
    for (const def of lineup.slotDefs) {
      const pid = lineup.slots[def.slotIndex] ?? null;
      result[def.slotIndex] = pid && playersById[pid] ? pid : null;
    }
    return result;
  }, [lineup.slotDefs, lineup.slots, playersById]);

  const benchPlayers = useMemo(() => {
    const onField = new Set(Object.values(fieldSlots).filter(Boolean) as string[]);
    return lineupPlayers.filter((p) => !onField.has(p.id));
  }, [lineupPlayers, fieldSlots]);

  const compAverage = (players: SquadPlayer[]) => {
    const values = players.filter((p) => p.competitiveness != null).map((p) => p.competitiveness as number);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const fieldCompAvg = compAverage(lineupPlayers.filter((p) => !benchPlayers.includes(p)));
  const benchCompAvg = compAverage(benchPlayers);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    const playerId = draggedPlayerId(active.id);
    const overId = over ? String(over.id) : null;
    if (overId?.startsWith("sim-slot-")) {
      lineup.placePlayer(playerId, parseInt(overId.replace("sim-slot-", "")));
      return;
    }
    lineup.benchPlayer(playerId);
  }

  if (!mgmtEventId) {
    return (
      <div className={styles.center}>
        <EmptyState description="No se encontró el partido en el sistema interno. Asegúrate de que el evento esté creado en el área de Partidos del equipo." />
      </div>
    );
  }

  if (lineupPlayers.length === 0) {
    return (
      <div className={styles.center}>
        <EmptyState description="No hay jugadores disponibles para la alineación." />
      </div>
    );
  }

  if (lineup.loading) {
    return (
      <div className={styles.center}>
        <CircularProgress size={32} />
      </div>
    );
  }

  const activeDragPlayer = activeDragId ? playersById[draggedPlayerId(activeDragId)] : null;

  const iconButton = (label: string, content: ReactNode, onClick: () => void, className: string) => (
    <button
      type="button"
      className={`${styles.avatarAction} ${className}`}
      title={label}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {content}
    </button>
  );

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

  const benchPanel = (
    <div className={simStyles.sidePanel}>
      <div className={simStyles.panelHeader}>
        Banquillo
        <span className={simStyles.panelBadge}>{benchPlayers.length}</span>
      </div>
      <DroppableBench>
        {benchPlayers.length === 0 ? (
          <p className={simStyles.emptyBench}>Todos los jugadores están en la alineación</p>
        ) : (
          <div className={simStyles.compactBenchItems}>
            {benchPlayers.map((p) => (
              <DraggableCompactBenchCard
                key={p.id}
                player={p}
                actions={
                  onDeconvoke &&
                  iconButton(
                    `Desconvocar a ${shortName(p)}`,
                    <PersonRemoveIcon sx={{ fontSize: 13 }} />,
                    () => onDeconvoke(p.id),
                    styles.deconvokeAction,
                  )
                }
              />
            ))}
          </div>
        )}
      </DroppableBench>
    </div>
  );

  const pendingPanel = pendingPlayers.length > 0 && (
    <div className={simStyles.sidePanel}>
      <div className={simStyles.panelHeader}>
        <span>Pendientes</span>
        <span className={simStyles.panelBadge}>{pendingPlayers.length}</span>
      </div>
      <div className={simStyles.compactBenchItems}>
        {pendingPlayers.map((p) => (
          <CompactBenchCard
            key={p.id}
            player={p}
            actions={
              onAcceptPending &&
              iconButton(`Aceptar convocatoria de ${shortName(p)}`, "✓", () => onAcceptPending(p.id), styles.acceptAction)
            }
          />
        ))}
      </div>
    </div>
  );

  const notCalledPanel = (
    <div className={simStyles.sidePanel}>
      <div className={simStyles.panelHeader}>
        <span>Desconvocados</span>
        <span className={simStyles.panelBadge}>{notCalledPlayers.length}</span>
      </div>
      {notCalledPlayers.length === 0 ? (
        <p className={simStyles.emptyBench}>Ninguno</p>
      ) : (
        <div className={simStyles.compactBenchItems}>
          {notCalledPlayers.map((p) => (
            <CompactBenchCard
              key={p.id}
              player={p}
              actions={
                p.isInjured ? (
                  <span className={styles.injuryTag} title="Lesionado">🏥</span>
                ) : (
                  onReconvoke &&
                  iconButton(`Pasar al banquillo a ${shortName(p)}`, "↩", () => onReconvoke(p.id), styles.reconvokeAction)
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );

  const notAttendingPanel = notAttendingPlayers.length > 0 && (
    <div className={simStyles.sidePanel}>
      <div className={simStyles.panelHeader}>
        <span>No asisten</span>
        <span className={simStyles.panelBadge}>{notAttendingPlayers.length}</span>
      </div>
      <div className={simStyles.compactBenchItems}>
        {notAttendingPlayers.map((p) => (
          <CompactBenchCard
            key={p.id}
            player={p}
            actions={
              <span className={styles.notAttendingReason}>
                {p.assistanceTypeId === 2 ? "No asistió (justificado)" : "No asistió"}
                {p.excuseReasonName ? ` · ${p.excuseReasonName}` : ""}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={liveStyles.root}>
      <div className={liveStyles.toolbar}>
        {lineup.formations.length > 0 && (
          <FormControl size="small" className={liveStyles.formationSelect}>
            <InputLabel id="lineup-formation-select-label">Esquema</InputLabel>
            <Select
              labelId="lineup-formation-select-label"
              label="Esquema"
              value={lineup.formationId}
              onChange={(e) => lineup.changeFormation(e.target.value as string)}
            >
              {lineup.formations.map((f) => (
                <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <div className={styles.legend}>
          <PlayerFormLegend />
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={liveStyles.liveMain}>
          <SimulationField
            className={liveStyles.liveField}
            slotDefs={lineup.slotDefs}
            slots={fieldSlots}
            prepareSlotsPreview={fieldSlots}
            playersById={playersById}
            playerMinutes={{}}
            prepareMode
            hideMinutes
          />
          <div className={liveStyles.liveSideColumn}>
            {ratingBar}
            {benchPanel}
            {pendingPanel}
            {notCalledPanel}
            {notAttendingPanel}
          </div>
        </div>
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
    </div>
  );
}
