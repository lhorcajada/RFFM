import React, { useEffect, useRef, useState } from "react";
import SimulationField from "../../../../convocations/components/simulation/SimulationField";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import styles from "./FieldWithBench.module.css";
import type { FormationSlotDef } from "../../../../../types/formation";

interface SimSlotPlayer {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  photoSrc?: string | null;
  dorsal?: number | null;
  competitiveness?: number | null;
  primaryPosition?: string | null;
  possiblePositions?: string[];
  teamName?: string | null;
}

interface Props {
  tabIndex: number;
  slotDefs: FormationSlotDef[];
  slots: Record<number, string | null>;
  bench: string[];
  playersById: Record<string, SimSlotPlayer>;
  maxHeight?: string | number;
  onFieldHeight?: (h: number) => void;
  activeTab?: number;
  usedTabById?: Record<string, number>;
}

export default function FieldWithBench({ tabIndex, slotDefs = [], slots = {}, bench = [], playersById = {}, maxHeight, onFieldHeight, activeTab, usedTabById }: Props) {
  // bench droppable id unique per tab
  const benchId = `sim-bench-prep-${tabIndex}`;
  const { setNodeRef: setBenchRef, isOver } = useDroppable({ id: benchId });
  const fieldWrapperRef = useRef<HTMLDivElement | null>(null);
  const [fieldH, setFieldH] = useState<number | null>(null);

  useEffect(() => {
    const el = fieldWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight;
      setFieldH(h);
      if (onFieldHeight) onFieldHeight(h);
    });
    ro.observe(el);
    // initial
    setTimeout(() => {
      const h = el.clientHeight;
      setFieldH(h);
      if (onFieldHeight) onFieldHeight(h);
    }, 0);
    return () => ro.disconnect();
  }, [onFieldHeight]);

  return (
    <div className={styles.root}>
      <div className={styles.fieldArea}>
        <SimulationField wrapperRef={fieldWrapperRef} slotDefs={slotDefs} slots={slots} playersById={playersById} prepareMode={true} slotIdPrefix={`prep-${tabIndex}`} playerMinutes={{}} activeTab={activeTab} usedTabById={usedTabById} />

        <div ref={setBenchRef} className={`${styles.bench} ${isOver ? styles.benchZoneOver : ""}`} style={{ height: fieldH ? `${fieldH}px` : (typeof maxHeight === 'number' ? `${maxHeight}px` : (maxHeight as any)) }}>
          <div className={styles.benchTitle}>
            <span>Banquillo</span>
            <span className={styles.benchCount}>{bench ? bench.length : 0}</span>
          </div>
          {/** group bench players by primary/first possible position */}
          {(() => {
            const map: Record<string, string[]> = {};
            for (const pid of bench) {
              const p = playersById[pid];
              let label = p?.primaryPosition ?? (p?.possiblePositions && p.possiblePositions.length ? p.possiblePositions[0] : "");
              if (!label) label = "Sin demarcación";
              if (!map[label]) map[label] = [];
              map[label].push(pid);
            }
            const labels = Object.keys(map);
            labels.sort((a, b) => {
              const pa = getGroupPriority(a);
              const pb = getGroupPriority(b);
              if (pa !== pb) return pa - pb;
              return a.localeCompare(b);
            });
            const groups = labels.map((k) => ({ label: k, ids: map[k] }));
            return groups.map((g) => {
                      const hue = getHueForLabel(g.label);
                      const headerBg = `hsla(${hue}, 70%, 45%, 0.08)`;
                      const pillBg = `hsl(${hue}, 70%, 45%)`;
                      return (
                        <div key={g.label} className={styles.benchGroup}>
                          <div className={styles.benchGroupHeader} style={{ backgroundColor: headerBg }}>
                            <strong>{g.label}</strong>
                            <span style={{ background: pillBg, color: '#fff' }}>{g.ids.length}</span>
                          </div>
                          <div className={styles.benchGroupList}>
                            {g.ids.map((pid) => (
                              <BenchCard key={pid} id={pid} player={playersById[pid]} activeTab={activeTab} usedTabById={usedTabById} />
                            ))}
                          </div>
                        </div>
                      );
                    });
          })()}
        </div>
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
  if (s.includes("port") || s.includes("arquero") || s.includes("guardameta")) return 0;
  if (s.includes("defen") || s.includes("lateral") || s.includes("central") || s.includes("zague") || s.includes("defensa")) return 1;
  if (s.includes("medio") || s.includes("centro") || s.includes("volante") || s.includes("medioc")) return 2;
  if (s.includes("extrem") || s.includes("ala") || s.includes("wing")) return 3;
  if (s.includes("delanter") || s.includes("punta") || s.includes("nueve") || s.includes("9")) return 4;
  return 98;
}

function BenchCard({ id, player, activeTab, usedTabById }: { id: string; player?: SimSlotPlayer | undefined; activeTab?: number; usedTabById?: Record<string, number> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `sim-player-${id}` });
  const style = { transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined } as React.CSSProperties;

  if (!player) return <div className={styles.benchItem}>Jugador</div>;
  const primary = player.primaryPosition ?? null;
  const possibles = player.possiblePositions ?? [];
  const posText = primary ? `Ideal: ${primary}` : (possibles.length ? `Posibles: ${possibles.join(', ')}` : '');
  const teamText = player.teamName ?? null;
  const usedTab = usedTabById ? usedTabById[id] : undefined;
  const usedElsewhere = typeof usedTab === 'number' && activeTab !== undefined && usedTab !== activeTab;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`${styles.benchItem} ${isDragging ? styles.benchItemDragging : ""} ${usedElsewhere ? styles.playerUsed : ""}`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontWeight: 700 }}>{player.alias ?? player.displayName}</div>
        {(posText || teamText) ? <div className={styles.benchMeta}>{[posText, teamText].filter(Boolean).join(' · ')}</div> : null}
      </div>
      {usedElsewhere ? <div className={styles.benchUsedBadge}>Equipo {usedTab! + 1}</div> : null}
    </div>
  );
}
