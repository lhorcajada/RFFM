import { CircularProgress } from "@mui/material";
import { Tooltip } from "@mui/material";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { GridCell, MatchColumn } from "./convocationMatchDetail.types";
import { NOT_CALLED_STATUS_IDS } from "./convocationMatchDetail.types";
import styles from "./DesconvocatoriasTab.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellColor(cell: GridCell | undefined): string {
  if (!cell || cell.statusId === null) return "";
  if (NOT_CALLED_STATUS_IDS.has(cell.statusId ?? -1)) return styles.cellAbsent;
  return styles.cellPresent;
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
  teamId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DesconvocatoriasTab({
  players,
  matchColumns,
  enrichedGrid,
  isLoading,
  teamId,
}: Props) {
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

  return (
    <div className={styles.tabContent}>
      <div className={styles.gridWrapper}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.playerCol}`}>Jugador</th>
              {matchColumns.map((col) => (
                <th key={col.eventId} className={styles.th}>
                  <Tooltip title={col.rival ?? col.date} placement="top">
                    <span className={styles.colLabel}>{col.label}</span>
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className={styles.row}>
                <td className={`${styles.td} ${styles.playerCell}`}>
                  <span className={styles.playerName}>{player.alias || player.name}</span>
                </td>
                {matchColumns.map((col) => {
                  const cell = enrichedGrid.get(col.eventId)?.get(player.id);
                  const isAbsent =
                    cell &&
                    cell.statusId !== null &&
                    NOT_CALLED_STATUS_IDS.has(cell.statusId);
                  return (
                    <td
                      key={col.eventId}
                      className={`${styles.td} ${styles.dataCell} ${cellColor(cell)}`}
                    >
                      <Tooltip
                        title={
                          cell
                            ? `${cell.statusName}${cell.excuseName ? ` · ${cell.excuseName}` : ""}`
                            : "Sin registro"
                        }
                        placement="top"
                      >
                        <span className={styles.cellContent}>
                          {isAbsent
                            ? cell?.excuseName
                              ? cell.excuseName.slice(0, 8)
                              : "✗"
                            : cell
                            ? "✓"
                            : ""}
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
