import { useMemo } from "react";
import { CircularProgress } from "@mui/material";
import { Tooltip } from "@mui/material";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { GridCell, MatchColumn } from "./convocationMatchDetail.types";
import styles from "./DesconvocatoriasTab.module.css";

// Status names that mean the player was NOT called up / deconvoked
const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);

function isCellNotCalled(cell: GridCell): boolean {
  return NOT_CALLED_NAMES.has(cell.statusName);
}

// ─── Cause colors ─────────────────────────────────────────────────────────────

type CauseColor = { bg: string; text: string };

const EXCUSE_TYPE_COLORS: Record<number, CauseColor> = {
  1: { bg: "rgba(240, 100, 100, 0.18)", text: "#f06464" },  // Injury
  2: { bg: "rgba(106, 180, 240, 0.18)", text: "#6ab4f0" },  // Study
  3: { bg: "rgba(255, 150, 64, 0.18)",  text: "#ff9640" },  // Ill
  4: { bg: "rgba(201, 136, 245, 0.18)", text: "#c988f5" },  // Family Problem
  5: { bg: "rgba(95, 212, 168, 0.18)",  text: "#5fd4a8" },  // Family Event
  6: { bg: "rgba(245, 200, 66, 0.18)",  text: "#f5c842" },  // Birthday Event
};

const FALLBACK_PALETTE: CauseColor[] = [
  { bg: "rgba(255, 100, 200, 0.18)", text: "#ff64c8" },
  { bg: "rgba(100, 240, 240, 0.18)", text: "#64f0f0" },
  { bg: "rgba(200, 200, 100, 0.18)", text: "#c8c864" },
];

const NO_DISPONIBLE_COLOR: CauseColor = { bg: "rgba(150, 150, 185, 0.18)", text: "#9696b9" };
const DECISION_TECNICA_COLOR: CauseColor = { bg: "rgba(255, 128, 64, 0.18)", text: "#ff8040" };

/** True when the cell represents a coach-initiated technical decision (no player excuse). */
function isTechnicalDecisionCell(cell: GridCell): boolean {
  if (cell.statusName === "No disponible") return false;
  if (!cell.excuseTypeId) return true;
  // excuseTypeId=7 is "Decisión técnica" — treat same as no excuse
  if (cell.excuseName?.toLowerCase().includes("decisi") ) return true;
  return false;
}

function getCauseColor(cell: GridCell): CauseColor {
  if (cell.statusName === "No disponible") return NO_DISPONIBLE_COLOR;
  if (isTechnicalDecisionCell(cell)) return DECISION_TECNICA_COLOR;
  if (EXCUSE_TYPE_COLORS[cell.excuseTypeId!]) return EXCUSE_TYPE_COLORS[cell.excuseTypeId!];
  return FALLBACK_PALETTE[(cell.excuseTypeId! - 7) % FALLBACK_PALETTE.length] ?? FALLBACK_PALETTE[0];
}

function getCauseLabel(cell: GridCell): string {
  if (cell.statusName === "No disponible") return "No disponible";
  if (isTechnicalDecisionCell(cell)) return "Decisión técnica";
  return cell.excuseName || "Causa desconocida";
}

function cellLabel(cell: GridCell | undefined): string {
  if (!cell || cell.statusId === null) return "—";
  if (cell.excuseName) return cell.excuseName;
  return cell.statusName || "—";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  players: PlayerResponse[];
  matchColumns: MatchColumn[];
  enrichedGrid: Map<string, Map<string, GridCell>>;
  isLoading: boolean;
  teamId: string;  /** Called when the coach clicks “Desconvocar” for a player in this grid (for the current match). */
  onDeconvokePlayer?: (playerId: string) => void;
  /** Players already in the “Desconvocados” zone of the current match (to show correct button state). */
  currentNotCalled?: string[];};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DesconvocatoriasTab({
  players,
  matchColumns,
  enrichedGrid,
  isLoading,
  teamId,
  onDeconvokePlayer,
  currentNotCalled = [],
}: Props) {
  // ── Filter columns to those with at least one deconvocation ──────────────
  const deconvocatingColumns = useMemo(
    () =>
      matchColumns.filter((col) => {
        const playerMap = enrichedGrid.get(col.eventId);
        if (!playerMap) return false;
        for (const cell of playerMap.values()) {
          if (isCellNotCalled(cell)) return true;
        }
        return false;
      }),
    [matchColumns, enrichedGrid]
  );

  // ── Filter players to those with at least one deconvocation ──────────────
  const deconvocatedPlayers = useMemo(
    () =>
      players.filter((player) =>
        deconvocatingColumns.some((col) => {
          const cell = enrichedGrid.get(col.eventId)?.get(player.id);
          return cell && isCellNotCalled(cell);
        })
      ),
    [players, deconvocatingColumns, enrichedGrid]
  );

  // ── Per-player stats: total deconvocations + consecutive-match streak ────
  const playerStats = useMemo(() => {
    const stats = new Map<string, { total: number; streak: number }>();
    for (const player of deconvocatedPlayers) {
      let total = 0;
      for (const col of deconvocatingColumns) {
        const cell = enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && isCellNotCalled(cell)) total++;
      }
      // Streak: consecutive matches from most recent (index 0) without a TECHNICAL DECISION.
      // Injuries and player excuses do NOT break the streak.
      let streak = 0;
      for (const col of matchColumns) {
        const cell = enrichedGrid.get(col.eventId)?.get(player.id);
        const isTechnicalDecision =
          cell &&
          isCellNotCalled(cell) &&
          isTechnicalDecisionCell(cell);
        if (isTechnicalDecision) break;
        streak++;
      }
      stats.set(player.id, { total, streak });
    }
    return stats;
  }, [deconvocatedPlayers, deconvocatingColumns, matchColumns, enrichedGrid]);

  // ── Cause counters ────────────────────────────────────────────────────────
  const causeCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; color: CauseColor }>();
    for (const col of deconvocatingColumns) {
      const playerMap = enrichedGrid.get(col.eventId);
      if (!playerMap) continue;
      for (const cell of playerMap.values()) {
        if (!isCellNotCalled(cell)) continue;
        const label = getCauseLabel(cell);
        const color = getCauseColor(cell);
        const existing = counts.get(label);
        if (existing) {
          existing.count++;
        } else {
          counts.set(label, { label, count: 1, color });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [deconvocatingColumns, enrichedGrid]);

  if (isLoading) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}>
          <CircularProgress />
        </div>
      </div>
    );
  }

  if (matchColumns.length === 0) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}>
          <EmptyState
            description={
              teamId
                ? "Aún no hay partidos registrados con asistencias. Esta cuadrícula se completará automáticamente cuando se registren los partidos jugados y sus convocatorias."
                : "No se ha encontrado el equipo. Accede desde el Dashboard seleccionando un equipo."
            }
          />
        </div>
      </div>
    );
  }

  if (deconvocatingColumns.length === 0) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}>
          <EmptyState description="No hay desconvocatorias registradas en ningún partido." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      {/* ── Cause counters ──────────────────────────────────────────────── */}
      {causeCounts.length > 0 && (
        <div className={styles.counters}>
          {causeCounts.map(({ label, count, color }) => (
            <span
              key={label}
              className={styles.counterBadge}
              style={{ background: color.bg, color: color.text, borderColor: color.text }}
            >
              {label}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDotTotal} /> Total desconvocatorias
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDotStreak} /> Jornadas desde la última decisión técnica
        </span>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div className={styles.gridWrapper}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.playerCol}`}>Jugador</th>
              {deconvocatingColumns.map((col) => (
                <th key={col.eventId} className={styles.th}>
                  <Tooltip title={col.rival ?? col.date} placement="top">
                    <span className={styles.colLabel}>{col.label}</span>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deconvocatedPlayers.map((player) => (
              <tr key={player.id} className={styles.row}>
                <td className={`${styles.td} ${styles.playerCell}`}>
                  <span className={styles.playerName}>{player.alias || player.name}</span>
                  <span className={styles.playerStats}>
                    <span className={styles.statBadgeTotal}>
                      <span className={styles.statIcon}>✕</span>
                      {playerStats.get(player.id)?.total ?? 0}
                    </span>
                    <span className={styles.statBadgeStreak}>
                      <span className={styles.statIcon}>↑</span>
                      {playerStats.get(player.id)?.streak ?? 0}
                    </span>
                  </span>
                  {onDeconvokePlayer && (
                    player.isInjured
                      ? (
                        <span className={styles.injuredDeconvokedTag}>
                          🩹 Desconvocado
                        </span>
                      )
                      : currentNotCalled.includes(player.id)
                        ? (
                          <span className={styles.alreadyDeconvokedTag}>
                            ✓ Desconvocado
                          </span>
                        )
                        : (
                          <button
                            className={styles.deconvokeBtn}
                            onClick={() => onDeconvokePlayer(player.id)}
                          >
                            Desconvocar
                          </button>
                        )
                  )}
                </td>
                {deconvocatingColumns.map((col) => {
                  const cell = enrichedGrid.get(col.eventId)?.get(player.id);
                  const isAbsent = cell && isCellNotCalled(cell);

                  if (!isAbsent) {
                    return (
                      <td key={col.eventId} className={`${styles.td} ${styles.dataCell}`} />
                    );
                  }

                  const causeColor = getCauseColor(cell);
                  const shortLabel = (cell.excuseName ?? getCauseLabel(cell)).slice(0, 8);

                  return (
                    <td
                      key={col.eventId}
                      className={`${styles.td} ${styles.dataCell}`}
                      style={{ background: causeColor.bg }}
                    >
                      <Tooltip
                        title={getCauseLabel(cell)}
                        placement="top"
                      >
                        <span className={styles.cellContent} style={{ color: causeColor.text }}>
                          {shortLabel}
                        </span>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// keep cellLabel available for potential future use (currently used inline via tooltip)
export { cellLabel };
