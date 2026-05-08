import { useState } from "react";
import { Box, Chip, CircularProgress, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "../../AttendanceSummary.module.css";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "./types";

interface Props {
  rows: PlayerMatchSummary[];
  columns: MatchAttendanceColumn[];
  onRefresh?: () => void;
  loading?: boolean;
}

function cellLabel(state: PlayerMatchSummary["cells"][number]["state"]): string {
  switch (state) {
    case "starter": return "T";
    case "called": return "C";
    case "notCalled": return "D";
    default: return "—";
  }
}

function cellTitle(state: PlayerMatchSummary["cells"][number]["state"]): string {
  switch (state) {
    case "starter": return "Titular";
    case "called": return "Convocado";
    case "notCalled": return "Desconvocado";
    default: return "No convocado";
  }
}

function formatHeader(column: MatchAttendanceColumn): string {
  return column.label;
}

const stateClassMap = {
  starter: styles.matchCellStarter,
  called: styles.matchCellCalled,
  notCalled: styles.matchCellNotCalled,
  absent: styles.matchCellAbsent,
} as const;

export default function AttendanceMatchesTab({ rows, columns, onRefresh, loading }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const toggleRow = (playerId: string) =>
    setSelected((prev) => (prev === playerId ? null : playerId));

  if (columns.length === 0 || rows.length === 0) {
    return (
      <EmptyState
        title="Sin datos de partidos"
        description="No hay partidos oficiales con convocatorias para mostrar en este resumen."
      />
    );
  }

  return (
    <Box>
      <Box className={styles.matchToolbar}>
        <Typography variant="body2" className={styles.matchToolbarDesc}>
          Se muestran solo partidos oficiales. Los amistosos quedan fuera de convocatorias y titularidades.
        </Typography>
        <Box className={styles.matchToolbarRight}>
          <Chip size="small" label={`${columns.length} jornadas`} />
          <Tooltip title="Actualizar datos">
            <span>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <TableContainer className={styles.matchTableContainer}>
        <Table size="small" className={styles.matchTable} stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className={`${styles.matchStickyCell} ${styles.matchHeaderCell}`}>Jugador</TableCell>
              {columns.map((column) => (
                <TableCell key={column.eventId} className={styles.matchHeaderCell} align="center">
                  <span className={styles.matchHeaderText}>{formatHeader(column)}</span>
                </TableCell>
              ))}
              <TableCell className={styles.matchHeaderCell} align="center">Totales</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.playerId}
                hover
                selected={selected === row.playerId}
                onClick={() => toggleRow(row.playerId)}
                className={styles.matchRowClickable}
              >
                <TableCell className={styles.matchStickyCell}>
                  <Typography variant="subtitle2" className={styles.matchPlayerName}>
                    {row.playerName}
                  </Typography>
                  <Box className={styles.matchPlayerChips}>
                    <Chip size="small" className={styles.matchMetricChip} label={`${row.calledMatches} convoc.`} />
                    <Chip size="small" className={styles.matchMetricChipSuccess} label={`${row.startedMatches} tit.`} />
                  </Box>
                </TableCell>
                {columns.map((column) => {
                  const cell = row.cells.find((item) => item.eventId === column.eventId);
                  const state = cell?.state ?? "absent";
                  return (
                    <TableCell key={`${row.playerId}-${column.eventId}`} align="center">
                      <span className={`${styles.matchCell} ${stateClassMap[state]}`} title={cellTitle(state)}>
                        {cellLabel(state)}
                      </span>
                    </TableCell>
                  );
                })}
                <TableCell align="center">
                  <Box className={styles.matchTotalsChips}>
                    <Chip size="small" className={styles.matchMetricChip} label={`${row.totalMatches} partidos`} />
                    <Chip size="small" className={styles.matchMetricChipMuted} label={`${row.notCalledMatches} no conv.`} />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}