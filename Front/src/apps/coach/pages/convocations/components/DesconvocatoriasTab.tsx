import { useMemo } from "react";
import { Button, CircularProgress } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { GridCell, MatchColumn } from "./convocationMatchDetail.types";
import { isCellNotCalled } from "../utils/deconvocationStats";
import DeconvocationHistory from "./DeconvocationHistory";
import type { HistoryEntry, SeasonCell } from "./DeconvocationHistory";
import styles from "./DesconvocatoriasTab.module.css";

// ─── Cause colors ─────────────────────────────────────────────────────────────

type CauseColor = { bg: string; text: string };

const EXCUSE_TYPE_COLORS: Record<number, CauseColor> = {
  1: { bg: "rgba(240, 100, 100, 0.18)", text: "#f06464" },  // Injury
  2: { bg: "rgba(106, 180, 240, 0.18)", text: "#6ab4f0" },  // Study
  3: { bg: "rgba(255, 150, 64, 0.18)",  text: "#ff9640" },  // Ill
  4: { bg: "rgba(201, 136, 245, 0.18)", text: "#c988f5" },  // Family Problem
  5: { bg: "rgba(95, 212, 168, 0.18)",  text: "#5fd4a8" },  // Family Event
  6: { bg: "rgba(245, 200, 66, 0.18)",  text: "#f5c842" },  // Birthday Event
  8: { bg: "rgba(255, 64, 96, 0.2)",    text: "#ff4060" },  // Sanción deportiva (forced Deconvoke)
};

// excuseTypeId=8 ("Sanción deportiva") means the Deconvoke convocation was forced by a
// Deconvocation-type sportive sanction (design.md Decisión 10) — same signal the backend
// itself uses to recognize its own forced transition, no separate flag needed.
const SANCTION_EXCUSE_TYPE_ID = 8;

function isSportiveSanctionCell(cell: GridCell): boolean {
  return cell.excuseTypeId === SANCTION_EXCUSE_TYPE_ID;
}

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
    const stats = new Map<string, { total: number; streak: number; technical: number }>();
    for (const player of deconvocatedPlayers) {
      let total = 0;
      let technical = 0;
      for (const col of deconvocatingColumns) {
        const cell = enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && isCellNotCalled(cell)) {
          total++;
          if (isTechnicalDecisionCell(cell)) technical++;
        }
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
      stats.set(player.id, { total, streak, technical });
    }
    return stats;
  }, [deconvocatedPlayers, deconvocatingColumns, matchColumns, enrichedGrid]);

  // ── Players ordered by total deconvocations, then by name ────────────────
  const sortedPlayers = useMemo(
    () =>
      [...deconvocatedPlayers].sort(
        (a, b) =>
          (playerStats.get(b.id)?.total ?? 0) - (playerStats.get(a.id)?.total ?? 0) ||
          (a.alias || a.name).localeCompare(b.alias || b.name, "es"),
      ),
    [deconvocatedPlayers, playerStats],
  );

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

  // ── Escape HTML for safe injection into the print window ──────────────
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Print summary handler ─────────────────────────────────────────────
  const handlePrintSummary = () => {
    const rows = deconvocatedPlayers
      .map((p) => {
        const stats = playerStats.get(p.id);
        return { name: p.alias || p.name, total: stats?.total ?? 0, streak: stats?.streak ?? 0, technical: stats?.technical ?? 0 };
      })
      .sort((a, b) => b.total - a.total);

    const rowsHtml = rows
      .map(
        (r) =>
          `<tr>
            <td>${escapeHtml(r.name)}</td>
            <td style="text-align:center">${r.total}</td>
            <td style="text-align:center">${r.technical}</td>
            <td style="text-align:center">${r.streak}</td>
          </tr>`
      )
      .join("");

    const dateStr = new Date().toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Resumen de Desconvocatorias</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 32px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p.subtitle { color: #555; font-size: 12px; margin: 0 0 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 7px 12px; }
    th { background: #f2f2f2; font-weight: 700; text-align: left; }
    tr:nth-child(even) { background: #fafafa; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Resumen de Desconvocatorias</h1>
  <p class="subtitle">${escapeHtml(dateStr)}</p>
  <table>
    <thead>
      <tr>
        <th>Jugador</th>
        <th>Total desconvocatorias</th>
        <th>Por decisión técnica</th>
        <th>Jornadas desde la última decisión técnica</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank", "width=720,height=620");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

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

  const totalDeconvocations = causeCounts.reduce((sum, c) => sum + c.count, 0);
  const matchesCount = deconvocatingColumns.length;

  return (
    <div className={styles.tabContent}>
      <div className={styles.summaryBar}>
        <span className={styles.summaryText}>
          {totalDeconvocations} {totalDeconvocations === 1 ? "desconvocatoria" : "desconvocatorias"} en {matchesCount}{" "}
          {matchesCount === 1 ? "partido" : "partidos"}
        </span>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PrintIcon fontSize="small" />}
          onClick={handlePrintSummary}
          className={styles.printBtn}
        >
          Imprimir resumen
        </Button>
      </div>

      {causeCounts.length > 0 && (
        <div className={styles.counters}>
          {causeCounts.map(({ label, count, color }) => (
            <span
              key={label}
              className={styles.counterBadge}
              aria-label={`${label}: ${count}`}
              style={{ background: color.bg, color: color.text, borderColor: color.text }}
            >
              {label}
              <strong>{count}</strong>
            </span>
          ))}
        </div>
      )}

      <ul className={styles.cards}>
        {sortedPlayers.map((player) => {
          const stats = playerStats.get(player.id);
          const name = player.alias || player.name;
          const entries: HistoryEntry[] = deconvocatingColumns.flatMap((col) => {
            const cell = enrichedGrid.get(col.eventId)?.get(player.id);
            if (!cell || !isCellNotCalled(cell)) return [];
            const color = getCauseColor(cell);
            return [
              {
                eventId: col.eventId,
                label: col.label,
                date: col.date,
                title: col.rival ?? col.date,
                cause: { label: getCauseLabel(cell), bg: color.bg, text: color.text },
                sanction: isSportiveSanctionCell(cell),
              },
            ];
          });
          const entryByEvent = new Map(entries.map((entry) => [entry.eventId, entry]));
          const seasonCells: SeasonCell[] = [...matchColumns].reverse().map((col) => ({
            eventId: col.eventId,
            label: col.label,
            cause: entryByEvent.get(col.eventId)?.cause ?? null,
          }));

          let deconvokeControl = null;
          if (onDeconvokePlayer) {
            if (player.isInjured) {
              deconvokeControl = <span className={styles.injuredDeconvokedTag}>Desconvocado</span>;
            } else if (currentNotCalled.includes(player.id)) {
              deconvokeControl = <span className={styles.alreadyDeconvokedTag}>Desconvocado</span>;
            } else {
              deconvokeControl = (
                <button
                  type="button"
                  className={styles.deconvokeBtn}
                  aria-label={`Desconvocar a ${name}`}
                  onClick={() => onDeconvokePlayer(player.id)}
                >
                  Desconvocar
                </button>
              );
            }
          }

          return (
            <li key={player.id} className={styles.card} aria-label={name}>
              <div className={styles.cardHeader}>
                <span className={styles.playerName}>{name}</span>
                {deconvokeControl}
              </div>

              <dl className={styles.stats}>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>Desconvocatorias</dt>
                  <dd className={styles.statValue}>{stats?.total ?? 0}</dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>Decisión técnica</dt>
                  <dd className={`${styles.statValue} ${styles.statTechnical}`}>{stats?.technical ?? 0}</dd>
                </div>
                <div className={styles.stat}>
                  <dt className={styles.statLabel}>Jornadas sin técnica</dt>
                  <dd className={`${styles.statValue} ${styles.statStreak}`}>{stats?.streak ?? 0}</dd>
                </div>
              </dl>

              <DeconvocationHistory playerName={name} seasonCells={seasonCells} entries={entries} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// keep cellLabel available for potential future use (currently used inline via tooltip)
export { cellLabel };
