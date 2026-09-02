import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useMemo, useState } from "react";
import EmptyState from "../../../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "../../AttendanceSummary.module.css";
import type { MatchAttendanceColumn, PlayerMatchSummary } from "./types";
import { exportMatchesFullPdf, exportMatchesSummaryPdf } from "./matchAttendancePdfExport";
import { coachAuthService } from "../../../../services/authService";

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

function stateLabel(state: PlayerMatchSummary["cells"][number]["state"]): string {
  switch (state) {
    case "starter": return "Titular";
    case "called": return "Convocado";
    case "notCalled": return "Desconvocado";
    default: return "No convocado";
  }
}

function cellTitle(state: PlayerMatchSummary["cells"][number]["state"], minutesPlayed: number | null): string {
  const base = stateLabel(state);
  return minutesPlayed != null ? `${base} (${minutesPlayed}')` : base;
}

function formatDate(value: string | null): string {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const stateClassMap = {
  starter: styles.matchCellStarter,
  called: styles.matchCellCalled,
  notCalled: styles.matchCellNotCalled,
  absent: styles.matchCellAbsent,
} as const;

const stateBadgeClassMap = {
  starter: styles.matchStateBadgeStarter,
  called: styles.matchStateBadgeCalled,
  notCalled: styles.matchStateBadgeNotCalled,
  absent: styles.matchStateBadgeAbsent,
} as const;

function isGoalkeeperPosition(position?: string | null): boolean {
  const p = (position ?? "").toLowerCase();
  return p.includes("portero") || p.includes("keeper") || p.includes("arquero");
}

function playerInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function findCell(row: PlayerMatchSummary, column: MatchAttendanceColumn) {
  const cell = row.cells.find((item) => item.eventId === column.eventId);
  return {
    state: cell?.state ?? "absent",
    minutesPlayed: cell?.minutesPlayed ?? null,
  } as const;
}

// Only the most recent matches are shown in the collapsed card's form strip —
// with a full season of jornadas the strip would otherwise grow unbounded.
// `columns` arrives already in chronological order, so the last N are the most recent.
const FORM_STRIP_MAX_MATCHES = 5;

export default function AttendanceMatchesTab({ rows, columns, onRefresh, loading }: Props) {
  const [exportingSummary, setExportingSummary] = useState(false);
  const [exportingFull, setExportingFull] = useState(false);
  const roles = useMemo(
    () => coachAuthService.getRoles().map((role) => role.toLowerCase()),
    []
  );
  const canExportPdf = !roles.some((role) =>
    ["player", "familyplayer", "familymember"].includes(role)
  );

  if (columns.length === 0 || rows.length === 0) {
    return (
      <EmptyState
        title="Sin datos de partidos"
        description="No hay partidos con convocatorias para mostrar en este resumen."
      />
    );
  }

  const formStripColumns = columns.slice(-FORM_STRIP_MAX_MATCHES);
  const formStripOmittedCount = columns.length - formStripColumns.length;
  const leagueColumnsCount = columns.filter((column) => !column.isFriendly).length;
  const friendlyColumnsCount = columns.length - leagueColumnsCount;

  return (
    <Box>
      <Box className={styles.matchToolbar}>
        {canExportPdf && (
          <Box className={styles.matchToolbarButtons}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdfOutlinedIcon />}
              disabled={exportingSummary}
              onClick={async () => {
                try {
                  setExportingSummary(true);
                  await exportMatchesSummaryPdf(rows, columns);
                } finally {
                  setExportingSummary(false);
                }
              }}
            >
              {exportingSummary ? "Generando PDF..." : "Exportar resumen"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdfOutlinedIcon />}
              disabled={exportingFull}
              onClick={async () => {
                try {
                  setExportingFull(true);
                  await exportMatchesFullPdf(rows, columns);
                } finally {
                  setExportingFull(false);
                }
              }}
            >
              {exportingFull ? "Generando PDF..." : "Exportar completo"}
            </Button>
          </Box>
        )}
        <Box className={styles.matchToolbarRight}>
          <Chip size="small" label={`${leagueColumnsCount} jornadas`} />
          {friendlyColumnsCount > 0 && (
            <Chip size="small" label={`${friendlyColumnsCount} amistosos`} />
          )}
          <Tooltip title="Actualizar datos">
            <span>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box className={styles.matchCardsGrid}>
        {rows.map((row) => (
          <Accordion key={row.playerId} className={styles.trainingCard} disableGutters elevation={0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} className={styles.trainingCardSummary}>
              <Box className={styles.matchCardSummaryContent}>
                <Box className={styles.matchCardIdentity}>
                  <Box className={styles.matchCardAvatarWrap}>
                    <Avatar
                      src={row.photoUrl ?? undefined}
                      alt={row.playerName}
                      className={styles.matchCardAvatar}
                    >
                      {playerInitials(row.playerName)}
                    </Avatar>
                    {row.dorsal != null && (
                      <span className={styles.matchDorsalBadge} title={`Dorsal ${row.dorsal}`}>
                        <svg
                          viewBox="0 0 24 24"
                          className={`${styles.matchDorsalJersey} ${
                            isGoalkeeperPosition(row.position) ? styles.matchDorsalJerseyKeeper : ""
                          }`}
                          aria-hidden="true"
                        >
                          <path d="M8.5 2 L4 4.5 L2 8 L4.5 9.8 L6 8 L6 21 L18 21 L18 8 L19.5 9.8 L22 8 L20 4.5 L15.5 2 C15.5 3.4 13.9 4.5 12 4.5 C10.1 4.5 8.5 3.4 8.5 2 Z" />
                        </svg>
                        <span className={styles.matchDorsalNumber}>{row.dorsal}</span>
                      </span>
                    )}
                  </Box>
                  <Box className={styles.matchCardIdentityText}>
                    <Typography variant="subtitle1" className={styles.playerName}>
                      {row.playerName}
                    </Typography>
                  </Box>
                </Box>

                <Box className={styles.matchCardStatsRow}>
                  <Chip size="small" className={styles.matchMetricChip} label={`${row.totalMatches} partidos`} />
                  <Chip size="small" className={styles.matchMetricChipSuccess} label={`${row.startedMatches} tit.`} />
                  <Chip size="small" className={styles.matchMetricChipMuted} label={`${row.notCalledMatches} no conv.`} />
                  <Chip
                    size="small"
                    className={styles.matchMetricChipInfo}
                    label={`${row.seasonMinutesPlayed ?? 0} min temporada`}
                  />
                </Box>

                <Box className={styles.matchFormStrip}>
                  {formStripOmittedCount > 0 && (
                    <span className={styles.matchFormStripHint}>últimos {FORM_STRIP_MAX_MATCHES}</span>
                  )}
                  {formStripColumns.map((column) => {
                    const { state, minutesPlayed } = findCell(row, column);
                    return (
                      <span
                        key={column.eventId}
                        className={`${styles.matchCell} ${stateClassMap[state]}`}
                        title={cellTitle(state, minutesPlayed)}
                      >
                        {cellLabel(state)}
                      </span>
                    );
                  })}
                </Box>
              </Box>
            </AccordionSummary>

            <AccordionDetails className={styles.trainingCardDetails}>
              <Box className={styles.matchDetailList}>
                {columns.map((column) => {
                  const { state, minutesPlayed } = findCell(row, column);
                  return (
                    <Box key={column.eventId} className={styles.matchDetailRow}>
                      <Box className={styles.matchDetailMain}>
                        <Typography variant="body2" component="div" className={styles.matchDetailLabel}>
                          {column.label}
                          {column.rival ? ` · ${column.rival}` : ""}
                          {column.isFriendly && (
                            <Chip size="small" label="Amistoso" className={styles.matchFriendlyTag} />
                          )}
                        </Typography>
                        <Box className={styles.matchDetailMeta}>
                          <Typography variant="caption">{formatDate(column.date)}</Typography>
                        </Box>
                      </Box>
                      <span className={`${styles.matchStateBadge} ${stateBadgeClassMap[state]}`}>
                        {stateLabel(state)}
                      </span>
                      {minutesPlayed != null && (
                        <Typography variant="body2" className={styles.matchDetailMinutes}>
                          {minutesPlayed}'
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
}
