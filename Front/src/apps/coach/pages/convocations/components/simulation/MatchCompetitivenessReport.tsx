import type { SubstitutionWindow } from "./simulation.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import styles from "./MatchCompetitivenessReport.module.css";

interface MatchCompetitivenessReportProps {
  initialSlots: Record<number, string | null>;
  windows: SubstitutionWindow[];
  finalSlots: Record<number, string | null>;
  playersById: Record<string, SimSlotPlayer>;
  halfDuration: number;
  playerMinutes?: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fieldPlayers(
  slots: Record<number, string | null>,
  playersById: Record<string, SimSlotPlayer>,
): SimSlotPlayer[] {
  return (Object.values(slots).filter(Boolean) as string[])
    .map((pid) => playersById[pid])
    .filter(Boolean) as SimSlotPlayer[];
}

function avgComp(players: SimSlotPlayer[]): number | null {
  const vals = players
    .map((p) => p.competitiveness)
    .filter((v): v is number => v != null);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function compColor(avg: number): string {
  if (avg >= 8) return "#4ade80";
  if (avg >= 6) return "#fb923c";
  return "#f87171";
}

// ─── Mini player chip ────────────────────────────────────────────────────────

function PlayerChip({ player, isNew }: { player: SimSlotPlayer; isNew: boolean }) {
  const initials = player.displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  const name = player.alias?.trim() || player.displayName.split(" ").slice(0, 2).join(" ");

  return (
    <div className={`${styles.chip} ${isNew ? styles.chipNew : ""}`} title={player.displayName}>
      <div className={styles.chipAvatar}>
        {player.photoSrc ? (
          <img src={player.photoSrc} alt={name} className={styles.chipImg} />
        ) : (
          <span className={styles.chipInitials}>{initials}</span>
        )}
        {player.dorsal != null && (
          <span className={styles.chipDorsal}>{player.dorsal}</span>
        )}
      </div>
      <span className={styles.chipName}>{name}</span>
      {player.competitiveness != null && (
        <span
          className={styles.chipComp}
          style={{ color: compColor(player.competitiveness) }}
        >
          {Math.round(player.competitiveness)}
        </span>
      )}
    </div>
  );
}

// ─── Period row ───────────────────────────────────────────────────────────────

interface PeriodProps {
  label: string;
  minuteFrom: number;
  minuteTo: number | null;
  players: SimSlotPlayer[];
  prevPlayerIds: Set<string>;
  isHalftimePeriod?: boolean;
}

function PeriodRow({
  label,
  minuteFrom,
  minuteTo,
  players,
  prevPlayerIds,
  isHalftimePeriod,
}: PeriodProps) {
  const avg = avgComp(players);
  const timeLabel = minuteTo != null
    ? `min ${minuteFrom} – ${minuteTo}`
    : `desde min ${minuteFrom}`;

  return (
    <div className={`${styles.period} ${isHalftimePeriod ? styles.periodHalftime : ""}`}>
      {/* Period header */}
      <div className={styles.periodHeader}>
        <span className={`${styles.periodLabel} ${isHalftimePeriod ? styles.periodLabelHalftime : ""}`}>
          {label}
        </span>
        <span className={styles.periodTime}>{timeLabel}</span>
        {avg != null && (
          <span
            className={styles.periodAvg}
            style={{
              color: compColor(avg),
              borderColor: `${compColor(avg)}44`,
              background: `${compColor(avg)}14`,
            }}
          >
            ★ {Math.round(avg)} media
          </span>
        )}
      </div>

      {/* Player chips */}
      <div className={styles.chipRow}>
        {players.map((p) => (
          <PlayerChip
            key={p.teamPlayerId}
            player={p}
            isNew={!prevPlayerIds.has(p.teamPlayerId)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MatchCompetitivenessReport({
  initialSlots,
  windows,
  finalSlots,
  playersById,
  halfDuration,
}: MatchCompetitivenessReportProps) {
  // Build period list
  // Period 0: initial lineup until first window (or end)
  // Period N: after window N until window N+1 (or end)

  type Period = {
    label: string;
    minuteFrom: number;
    minuteTo: number | null;
    slots: Record<number, string | null>;
    prevSlots: Record<number, string | null>;
    isHalftimePeriod?: boolean;
  };

  const periods: Period[] = [];

  // Sort real windows (non-halftime first for ordering, but keep halftime for display)
  const sortedWins = [...windows].sort((a, b) => a.minute - b.minute);

  const firstWin = sortedWins[0];
  periods.push({
    label: "Inicio",
    minuteFrom: 0,
    minuteTo: firstWin ? firstWin.minute : null,
    slots: initialSlots,
    prevSlots: {},
  });

  for (let i = 0; i < sortedWins.length; i++) {
    const win = sortedWins[i];
    const next = sortedWins[i + 1];
    const isHalf = win.isHalftime === true;
    periods.push({
      label: isHalf ? "Descanso" : `Ventana ${win.windowIndex}`,
      minuteFrom: win.minute,
      minuteTo: next ? next.minute : null,
      slots: win.slotsAfter,
      prevSlots: i === 0 ? initialSlots : sortedWins[i - 1].slotsAfter,
      isHalftimePeriod: isHalf,
    });
  }

  // If no windows, just show the full match with initial lineup
  if (periods.length === 1 && !firstWin) {
    periods[0].minuteTo = halfDuration * 2;
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Competitividad por período</span>
        <span className={styles.headerSub}>
          Jugadores en campo y media de valoración entre ventanas
        </span>
      </div>

      <div className={styles.body}>
        {periods.map((p, idx) => {
          const players = fieldPlayers(p.slots, playersById);
          const prevIds = new Set(
            (Object.values(p.prevSlots).filter(Boolean) as string[])
          );
          return (
            <PeriodRow
              key={idx}
              label={p.label}
              minuteFrom={p.minuteFrom}
              minuteTo={p.minuteTo}
              players={players}
              prevPlayerIds={prevIds}
              isHalftimePeriod={p.isHalftimePeriod}
            />
          );
        })}
      </div>
    </div>
  );
}
