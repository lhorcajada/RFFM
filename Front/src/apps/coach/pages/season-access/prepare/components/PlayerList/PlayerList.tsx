import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import styles from "./PlayerList.module.css";
import type { SeasonAccessDemarcation, SeasonAccessTrialPlayerDto } from "../../../../../services/seasonAccessService";

interface Props {
  players: SeasonAccessTrialPlayerDto[];
  demarcations?: SeasonAccessDemarcation[];
  maxHeight?: string | number;
  fieldHeight?: number | null;
  activeTab?: number;
  usedTabById?: Record<string, number>;
  usedLocationById?: Record<string, { tab: number; type: 'slot' | 'bench'; slotIndex?: number }>;
  activeDragId?: string | null;
}

export default function PlayerList({ players = [], demarcations = [], maxHeight, fieldHeight = null, activeTab, usedTabById = {}, usedLocationById = {}, activeDragId = null }: Props) {
  const demMap = React.useMemo(() => {
    const m: Record<number, string> = {};
    for (const d of demarcations || []) m[d.id] = d.name;
    return m;
  }, [demarcations]);

  // droppable for list so players can be returned here
  const { setNodeRef: setListRef, isOver } = useDroppable({ id: "prep-list" });

  const headerRef = React.useRef<HTMLDivElement | null>(null);
  const [listH, setListH] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    if (!fieldHeight) {
      setListH(null);
      return;
    }
    const headerEl = headerRef.current;
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
    // subtract a small gap for padding
    const computed = Math.max(0, fieldHeight - Math.round(headerH) - 8);
    setListH(computed);
  }, [fieldHeight]);

  const sortedPlayers = React.useMemo(() => {
    const src = (players || []).slice();
    return src.sort((a, b) => {
      const aPrimary = a.idealDemarcationId ? demMap[a.idealDemarcationId] ?? "" : (a.possibleDemarcationIds && a.possibleDemarcationIds.length ? demMap[a.possibleDemarcationIds[0]] ?? "" : "");
      const bPrimary = b.idealDemarcationId ? demMap[b.idealDemarcationId] ?? "" : (b.possibleDemarcationIds && b.possibleDemarcationIds.length ? demMap[b.possibleDemarcationIds[0]] ?? "" : "");
      if ((aPrimary || "") !== (bPrimary || "")) return (aPrimary || "").localeCompare(bPrimary || "");
      const aName = a.playerName ?? a.federationPlayerCode ?? String(a.id);
      const bName = b.playerName ?? b.federationPlayerCode ?? String(b.id);
      return aName.localeCompare(bName);
    });
  }, [players, demMap]);

  const grouped = React.useMemo(() => {
    const map: Record<string, SeasonAccessTrialPlayerDto[]> = {};
    for (const p of sortedPlayers) {
      const primary = p.idealDemarcationId ? demMap[p.idealDemarcationId] ?? "" : (p.possibleDemarcationIds && p.possibleDemarcationIds.length ? demMap[p.possibleDemarcationIds[0]] ?? "" : "");
      const label = primary || "Sin demarcación";
      if (!map[label]) map[label] = [];
      map[label].push(p);
    }
    const labels = Object.keys(map);
    labels.sort((a, b) => {
      const pa = getGroupPriority(a);
      const pb = getGroupPriority(b);
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });
    return labels.map((k) => ({ label: k, players: map[k] }));
  }, [sortedPlayers, demMap]);

  return (
    <div className={styles.root}>
      <div ref={headerRef} className={styles.header}>
        <strong>Lista de jugadores</strong>
        <span>{players.length}</span>
      </div>

      <div ref={setListRef} data-droppable-id={"prep-list"} className={styles.listWrap} style={ listH ? { height: `${listH}px` } : { maxHeight: maxHeight ?? 480 } }>
        {grouped.map((g) => {
          const hue = getHueForLabel(g.label);
          const headerBg = `hsla(${hue}, 70%, 45%, 0.08)`;
          const pillBg = `hsl(${hue}, 70%, 45%)`;
          return (
            <div key={g.label} className={styles.group}>
              <div className={styles.groupHeader} style={{ backgroundColor: headerBg }}>
                <strong>{g.label}</strong>
                <span style={{ background: pillBg, color: '#fff' }}>{g.players.length}</span>
              </div>
              <div className={styles.groupList}>
                {g.players.map((p) => (
                  <DraggablePlayer key={String(p.id)} player={p} demMap={demMap} activeTab={activeTab} usedTabById={usedTabById} usedLocationById={usedLocationById} activeDragId={activeDragId} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getHueForLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function getGroupPriority(label: string) {
  const s = (label || "").toLowerCase();
  if (!s || s.includes("sin demarc")) return 99;
  // Porteros
  if (s.includes("port") || s.includes("arquero") || s.includes("guardameta")) return 0;
  // Defensas centrales y laterales
  if (s.includes("defen") || s.includes("lateral") || s.includes("central") || s.includes("zague") || s.includes("defensa")) return 1;
  // Medios
  if (s.includes("medio") || s.includes("centro") || s.includes("volante") || s.includes("medioc")) return 2;
  // Extremos
  if (s.includes("extrem") || s.includes("ala") || s.includes("wing")) return 3;
  // Delanteros
  if (s.includes("delanter") || s.includes("punta") || s.includes("nueve") || s.includes("9")) return 4;
  return 98;
}

function DraggablePlayer({ player, demMap, activeTab, usedTabById, usedLocationById, activeDragId }: { player: SeasonAccessTrialPlayerDto; demMap: Record<number, string>; activeTab?: number; usedTabById?: Record<string, number>; usedLocationById?: Record<string, { tab: number; type: 'slot' | 'bench'; slotIndex?: number }>; activeDragId?: string | null }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `sim-player-list-${player.id}` });
  const style = { transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined } as React.CSSProperties;
  const possible = (player.possibleDemarcationIds ?? []).map((id) => demMap[id]).filter(Boolean).join(", ");
  const ideal = player.idealDemarcationId ? demMap[player.idealDemarcationId] : null;
  const teamName = player.teamName ?? player.teamCode ?? null;

  const usedTab = usedTabById ? usedTabById[String(player.id)] : undefined;
  const usedLocation = usedLocationById ? usedLocationById[String(player.id)] : undefined;
  const usedElsewhere = typeof usedTab === 'number' && activeTab !== undefined && usedTab !== activeTab;
  const isOnField = usedLocation?.type === 'slot' && usedLocation?.tab === activeTab;
  const isOnBench = usedLocation?.type === 'bench' && usedLocation?.tab === activeTab;
  const isActiveDrag = activeDragId != null && String(activeDragId) === String(player.id);

  const classes = [`${styles.playerItem}`, isDragging ? styles.dragging : "", usedElsewhere ? styles.playerUsed : "", isOnField ? styles.playerOnField : "", isOnBench ? styles.playerOnBench : "", isActiveDrag && (isOnField || isOnBench) ? styles.playerOnFieldDragging : ""].filter(Boolean).join(" ");

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={classes} title={player.playerName ?? String(player.id)}>
      <div>
        <div className={styles.playerName}>{player.playerName ?? player.federationPlayerCode ?? "Jugador"}</div>
        {teamName ? <div className={styles.playerMeta}>Equipo: {teamName}</div> : null}
        <div className={styles.playerMeta}>{ideal ? `Ideal: ${ideal}` : ""}{possible ? ` · Posibles: ${possible}` : ""}</div>
      </div>
      {isOnField ? (
        <div className={styles.onFieldBadge}>En campo</div>
      ) : isOnBench ? (
        <div className={styles.benchBadge}>Banquillo</div>
      ) : usedElsewhere ? (
        <div className={styles.usedBadge}>{usedLocation?.type === 'bench' ? `Banquillo Equipo ${usedTab! + 1}` : `Equipo ${usedTab! + 1}`}</div>
      ) : null}
    </div>
  );
}
