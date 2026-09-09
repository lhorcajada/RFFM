import { useMemo, useState } from "react";
import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import { exportSquadStatisticsPdf } from "../squadStatsPdfExport";
import styles from "./SquadStatistics.module.css";

type Props = {
  players: PlayerStatistics[];
  loading: boolean;
  teamName?: string;
};

type SortKey = "formStatus" | "dorsal" | "goals" | "yellowCards" | "redCards" | "minutesPlayed";

type SortDirection = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "formStatus", label: "Estado de forma" },
  { key: "dorsal", label: "Dorsal" },
  { key: "goals", label: "Goles" },
  { key: "yellowCards", label: "Amarillas" },
  { key: "redCards", label: "Rojas" },
  { key: "minutesPlayed", label: "Minutos" },
];

function formStatusColor(value: number): "success" | "warning" | "error" {
  if (value >= 80) return "success";
  if (value >= 50) return "warning";
  return "error";
}

function compareValues(a: PlayerStatistics, b: PlayerStatistics, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  return Number(av) - Number(bv);
}

function injuryLabel(player: PlayerStatistics): string | null {
  if (player.daysSinceLastInjury == null) return null;
  const dur =
    player.lastInjuryDurationDays == null
      ? "en curso"
      : `${player.lastInjuryDurationDays} días de baja`;
  return `Lesión: hace ${player.daysSinceLastInjury} días (${dur})`;
}

export default function SquadStatistics({ players, loading, teamName }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("formStatus");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [positionFilter, setPositionFilter] = useState<string>("");

  const positions = useMemo(
    () => Array.from(new Set(players.map((p) => p.position).filter((p): p is string => Boolean(p)))).sort((a, b) => a.localeCompare(b, "es")),
    [players],
  );

  const filteredAndSorted = useMemo(() => {
    const filtered = positionFilter
      ? players.filter((p) => p.position === positionFilter)
      : players;

    const sorted = [...filtered].sort((a, b) => {
      const cmp = compareValues(a, b, sortKey);
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [players, positionFilter, sortKey, sortDirection]);

  function handleSortKeyChange(_e: React.MouseEvent<HTMLElement>, value: SortKey | null) {
    if (value) setSortKey(value);
  }

  function handleToggleDirection() {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function handlePositionFilterChange(e: SelectChangeEvent) {
    setPositionFilter(e.target.value);
  }

  if (loading) {
    return <div className={styles.empty}>Cargando...</div>;
  }

  if (players.length === 0) {
    return <div className={styles.empty}>No hay jugadores para mostrar.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.sortControl}>
          <span className={styles.sortLabel}>Ordenar por:</span>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={sortKey}
            onChange={handleSortKeyChange}
            aria-label="Ordenar por"
          >
            {SORT_OPTIONS.map(({ key, label }) => (
              <ToggleButton key={key} value={key}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Tooltip title={sortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}>
            <IconButton
              size="small"
              onClick={handleToggleDirection}
              aria-label={sortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
            >
              {sortDirection === "asc" ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </div>

        <div className={styles.toolbarRight}>
          <FormControl size="small" className={styles.positionFilter}>
            <InputLabel id="squad-statistics-position-filter-label">Posición</InputLabel>
            <Select
              labelId="squad-statistics-position-filter-label"
              label="Posición"
              value={positionFilter}
              onChange={handlePositionFilterChange}
            >
              <MenuItem value="">Todas</MenuItem>
              {positions.map((position) => (
                <MenuItem key={position} value={position}>
                  {position}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            startIcon={<PictureAsPdfOutlinedIcon />}
            onClick={() => exportSquadStatisticsPdf(filteredAndSorted, teamName)}
          >
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className={styles.grid}>
        {filteredAndSorted.map((player) => {
          const injury = injuryLabel(player);
          return (
            <div
              key={player.teamPlayerId}
              className={styles.card}
              data-testid={`squad-stat-card-${player.teamPlayerId}`}
            >
              <div className={styles.cardHeader}>
                <span className={styles.dorsal}>{player.dorsal ?? "—"}</span>
                <div className={styles.headerText}>
                  <span className={styles.name} data-testid="squad-stat-player-name">
                    {player.displayName}
                  </span>
                  {player.position && <span className={styles.position}>{player.position}</span>}
                </div>
              </div>

              <div className={styles.formStatusRow}>
                {player.formStatus == null ? (
                  <Typography variant="body2" color="text.secondary">
                    Sin datos
                  </Typography>
                ) : (
                  <Tooltip
                    title={
                      <div>
                        <div>Entreno: {Math.round(player.formStatusBreakdown?.trainingComponent ?? 0)}%</div>
                        <div>Partidos: {Math.round(player.formStatusBreakdown?.matchComponent ?? 0)}%</div>
                        {player.formStatusBreakdown?.recentAbsences.map((absence) => (
                          <div key={absence.eventId}>
                            {absence.date ? new Date(absence.date).toLocaleDateString("es-ES") : "—"} · {absence.reason} · {absence.pointsImpact}
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <div className={styles.formStatusBar} data-testid={`form-status-cell-${player.teamPlayerId}`}>
                      <LinearProgress
                        variant="determinate"
                        value={player.formStatus}
                        color={formStatusColor(player.formStatus)}
                        className={styles.progressBar}
                      />
                      <span className={styles.formStatusValue}>{player.formStatus}%</span>
                    </div>
                  </Tooltip>
                )}
              </div>

              <div className={styles.statsRow}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.goals}</span>
                  <span className={styles.statLabel}>Goles</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.yellowCards}</span>
                  <span className={styles.statLabel}>Amar.</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.redCards}</span>
                  <span className={styles.statLabel}>Rojas</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.minutesPlayed}</span>
                  <span className={styles.statLabel}>Min.</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.trainingsAttended}</span>
                  <span className={styles.statLabel}>Entren.</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.matchesPlayed}</span>
                  <span className={styles.statLabel}>Partidos</span>
                </div>
              </div>

              {injury && <div className={styles.injuryLine}>{injury}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
