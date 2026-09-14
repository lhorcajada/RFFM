import { useDroppable } from "@dnd-kit/core";
import PlayerFormBars from "../../../../components/PlayerFormBars/PlayerFormBars";
import type { SquadPlayer } from "../../../squad/components/IdealLineup";
import { computeLiveReadiness } from "../../utils/liveReadiness";
import styles from "../SimulacionTab.module.css";

// ─── Position grouping helper ─────────────────────────────────────────────────

export const BENCH_POSITION_GROUPS: { label: string; color: string; test: (p: string) => boolean }[] = [
  { label: "Porteros",        color: "#f59e0b", test: (p) => p.includes("portero") || p.includes("keeper") || p.includes("arquero") },
  { label: "Defensas",        color: "#3b82f6", test: (p) => p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero") || p.includes("stopper") },
  { label: "Centrocampistas", color: "#10b981", test: (p) => p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante") },
  { label: "Delanteros",      color: "#ef4444", test: (p) => p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger") },
];

export function groupBenchPlayers(players: SquadPlayer[]) {
  const groups = BENCH_POSITION_GROUPS.map((g) => ({ ...g, players: [] as SquadPlayer[] }));
  const others: SquadPlayer[] = [];
  for (const p of players) {
    const lower = (p.position ?? "").toLowerCase();
    const idx = BENCH_POSITION_GROUPS.findIndex((g) => g.test(lower));
    if (idx >= 0) groups[idx].players.push(p);
    else others.push(p);
  }
  if (others.length > 0) groups.push({ label: "Sin posición", color: "#6b7280", players: others, test: () => false });
  return groups.filter((g) => g.players.length > 0);
}

// ─── Bench player card (draggable in prepare mode, static otherwise) ──────────

export function BenchPlayerCard({
  player,
  isDragActive,
  isLeaving,
  minutesPlayed,
  hasPlayed,
  groupColor,
}: {
  player: SquadPlayer;
  isDragActive: boolean;
  isLeaving: boolean;
  minutesPlayed?: number;
  hasPlayed?: boolean;
  groupColor?: string;
}) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      className={`${styles.benchCard} ${isDragActive ? styles.benchCardDragging : ""} ${isLeaving ? styles.benchCardLeaving : ""}`}
      style={groupColor && !isLeaving ? { borderLeftColor: groupColor, borderLeftWidth: 3 } : undefined}
      title={player.displayName}
    >
      {/* Top row: info + photo */}
      <div className={styles.benchCardTopRow}>
        <div className={styles.benchCardInfo}>
          <div className={styles.benchCardNameRow}>
            {player.dorsal != null && (
              <span className={styles.benchCardDorsal}>{player.dorsal}</span>
            )}
            <span className={styles.benchCardName}>
              {player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ")}
            </span>
            {player.isInjured && <span title="Lesionado" style={{ fontSize: "0.7rem" }}>🩹</span>}
          </div>
          {player.position && (
            <div className={styles.benchCardPosition}>{player.position}</div>
          )}
        </div>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={player.displayName} className={styles.benchCardAvatar} />
        ) : (
          <div className={styles.benchCardInitials}>{initials}</div>
        )}
      </div>

      {/* Bottom row: badges + minutes/SALE */}
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
          {player.streakCount != null && (
            <span className={styles.benchStreakBadge} title="Jornadas sin decisión técnica">
              ⏱ {player.streakCount}
            </span>
          )}
        </div>
        {!isLeaving ? (
          hasPlayed
            ? <span className={styles.benchMinTag}>{minutesPlayed}&apos;</span>
            : <span className={styles.benchNoPlayTag}>—</span>
        ) : (
          <span className={styles.benchCardSaleBadge}>SALE</span>
        )}
      </div>
      <PlayerFormBars
        variant="full"
        readiness={computeLiveReadiness(player.readinessBreakdown, minutesPlayed ?? 0)}
        fatigue={player.fatigue}
        className={styles.benchFormBars}
      />
    </div>
  );
}

// ─── Droppable bench zone ─────────────────────────────────────────────────────

export function DroppableBench({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "sim-bench" });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.benchZone} ${isOver ? styles.benchZoneOver : ""}`}
    >
      {children}
    </div>
  );
}
