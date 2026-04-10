import type { SimulationPlayerState, SubstitutionWindow } from "./simulation.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import type { FormationSlotDef } from "../../../../types/formation";
import styles from "./MatchSummaryPanel.module.css";

interface MatchSummaryPanelProps {
  /** Initial slot layout (starters) */
  initialSlots: Record<number, string | null>;
  /** Final slot layout after all windows */
  finalSlots: Record<number, string | null>;
  slotDefs: FormationSlotDef[];
  playersById: Record<string, SimSlotPlayer>;
  playerStates: Record<string, SimulationPlayerState>;
  playerMinutes: Record<string, number>;
  windows: SubstitutionWindow[];
  totalMinutes: number;
}

// ─── Small player card for the summary grid ────────────────────────────────

function SummaryPlayerCard({
  player,
  minutes,
  isStarter,
  wasSub,
}: {
  player: SimSlotPlayer;
  minutes: number;
  isStarter: boolean;
  wasSub: boolean;
}) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const name = player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ");

  return (
    <div className={`${styles.playerCard} ${wasSub ? styles.playerCardSub : ""}`}>
      <div className={styles.avatar}>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={name} className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarInitials}>{initials}</span>
        )}
        {player.dorsal != null && (
          <span className={styles.dorsal}>{player.dorsal}</span>
        )}
        {isStarter && (
          <span className={styles.starterBadge} title="Titular">11</span>
        )}
        {wasSub && (
          <span className={styles.subBadge} title="Suplente">S</span>
        )}
      </div>
      <span className={styles.playerName}>{name}</span>
      <span className={styles.playerMinutes}>{minutes}&apos;</span>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function MatchSummaryPanel({
  initialSlots,
  finalSlots,
  slotDefs,
  playersById,
  playerStates,
  playerMinutes,
  windows,
  totalMinutes,
}: MatchSummaryPanelProps) {
  // Build starter IDs (players in initial slots)
  const starterIds = new Set(
    Object.values(initialSlots).filter(Boolean) as string[],
  );

  // Build final player list ordered by slot definition
  const finalPlayerIds = slotDefs
    .map((def) => finalSlots[def.slotIndex] ?? null)
    .filter(Boolean) as string[];

  // Subs: players who entered during the match (not starters, have played)
  const subIds = Object.entries(playerStates)
    .filter(([pid]) => !starterIds.has(pid) && (playerMinutes[pid] ?? 0) > 0)
    .sort((a, b) => (a[1].minuteEntered ?? 0) - (b[1].minuteEntered ?? 0))
    .map(([pid]) => pid);

  // Count total substitutions made
  const totalSwaps = windows.reduce((n, w) => n + w.swaps.length, 0);

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerIcon}>🏁</span>
        <div>
          <h3 className={styles.headerTitle}>Resumen del partido</h3>
          <p className={styles.headerSub}>
            {totalMinutes} min jugados · {windows.filter(w => !w.isHalftime).length} ventanas · {totalSwaps} cambios
          </p>
        </div>
      </div>

      {/* Two columns: starters | subs/final */}
      <div className={styles.columns}>
        {/* Starters */}
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={`${styles.sectionBadge} ${styles.eleven}`}>11</span>
            Once inicial
          </h4>
          <div className={styles.playerGrid}>
            {Array.from(starterIds).map((pid) => {
              const p = playersById[pid];
              if (!p) return null;
              const mins = playerMinutes[pid] ?? 0;
              return (
                <SummaryPlayerCard
                  key={pid}
                  player={p}
                  minutes={mins}
                  isStarter={true}
                  wasSub={false}
                />
              );
            })}
          </div>
        </section>

        {/* Subs used */}
        {subIds.length > 0 && (
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <span className={`${styles.sectionBadge} ${styles.sub}`}>S</span>
              Suplentes utilizados
            </h4>
            <div className={styles.playerGrid}>
              {subIds.map((pid) => {
                const p = playersById[pid];
                if (!p) return null;
                const mins = playerMinutes[pid] ?? 0;
                return (
                  <SummaryPlayerCard
                    key={pid}
                    player={p}
                    minutes={mins}
                    isStarter={false}
                    wasSub={true}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Final field snapshot */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>
            <span className={`${styles.sectionBadge} ${styles.final}`}>▦</span>
          Equipo al final del partido
        </h4>
        <div className={styles.playerGridFinal}>
          {finalPlayerIds.map((pid) => {
            const p = playersById[pid];
            if (!p) return null;
            const mins = playerMinutes[pid] ?? 0;
            const isSub = !starterIds.has(pid);
            return (
              <SummaryPlayerCard
                key={pid}
                player={p}
                minutes={mins}
                isStarter={!isSub}
                wasSub={isSub}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
