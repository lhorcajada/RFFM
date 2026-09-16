import { useMemo, useState } from "react";
import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import { SEASON_MINUTES_TARGET_PERCENT } from "../../../services/teamPlayerStatisticsService";
import { exportSquadStatisticsPdf } from "../squadStatsPdfExport";
import { calledButAbsentLabel, injuryLabel, minutesTargetCaption } from "../playerStatsText";
import PlayerFormBars from "../../../components/PlayerFormBars/PlayerFormBars";
import PlayerFormLegend from "../../../components/PlayerFormLegend/PlayerFormLegend";
import { computeEf } from "../../../utils/playerFormMetrics";
import styles from "./SquadStatistics.module.css";

type Props = {
  players: PlayerStatistics[];
  loading: boolean;
  teamName?: string;
};

type SortKey = "ef" | "readiness" | "fatigue" | "dorsal" | "goals" | "yellowCards" | "redCards" | "minutesPlayed";

type SortDirection = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "ef", label: "Estado de forma" },
  { key: "readiness", label: "Rodaje" },
  { key: "fatigue", label: "Cansancio" },
  { key: "dorsal", label: "Dorsal" },
  { key: "goals", label: "Goles" },
  { key: "yellowCards", label: "Amarillas" },
  { key: "redCards", label: "Rojas" },
  { key: "minutesPlayed", label: "Minutos" },
];

function sortValue(player: PlayerStatistics, key: SortKey): number | null {
  if (key === "ef") return computeEf(player.readiness, player.fatigue);
  return player[key] as number | null;
}

function compareValues(a: PlayerStatistics, b: PlayerStatistics, key: SortKey): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  if (av == null && bv == null) return 0;
  if (av == null) return -1;
  if (bv == null) return 1;
  return Number(av) - Number(bv);
}

export default function SquadStatistics({ players, loading, teamName }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ef");
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

  function handleSortKeyChange(e: SelectChangeEvent) {
    setSortKey(e.target.value as SortKey);
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
          <FormControl size="small" className={styles.sortSelect}>
            <InputLabel id="squad-statistics-sort-label">Ordenar por</InputLabel>
            <Select
              labelId="squad-statistics-sort-label"
              label="Ordenar por"
              value={sortKey}
              onChange={handleSortKeyChange}
            >
              {SORT_OPTIONS.map(({ key, label }) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title={sortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}>
            <IconButton
              size="small"
              onClick={handleToggleDirection}
              aria-label={sortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
              sx={{
                border: "1px solid",
                borderColor: "rgba(255, 255, 255, 0.23)",
                borderRadius: 1,
                flexShrink: 0,
              }}
            >
              {sortDirection === "asc" ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </div>

        <div className={styles.toolbarRight}>
          <FormControl
            size="small"
            className={styles.positionFilter}
            sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
          >
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
            sx={{ width: { xs: "100%", sm: "auto" }, whiteSpace: "nowrap" }}
          >
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className={styles.legendRow}>
        <PlayerFormLegend />
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

              <div className={styles.conditionRow}>
                <PlayerFormBars
                  variant="full"
                  readiness={player.readiness}
                  fatigue={player.fatigue}
                  readinessTooltip={
                    player.readinessBreakdown && (
                      <div>
                        <div>Entreno: {Math.round(player.readinessBreakdown.trainingComponent)}%</div>
                        <div>Partidos: {Math.round(player.readinessBreakdown.matchComponent)}%</div>
                        {player.readinessBreakdown.recentAbsences.map((absence) => (
                          <div key={absence.eventId}>
                            {absence.date ? new Date(absence.date).toLocaleDateString("es-ES") : "—"} · {absence.reason} · {absence.pointsImpact}
                          </div>
                        ))}
                      </div>
                    )
                  }
                />
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
                  <span className={styles.statValue}>{player.matchesAbsentAttributableToPlayer}</span>
                  <span className={styles.statLabel}>Ausencias</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.trainings.attended} de {player.trainings.possible}</span>
                  <span className={styles.statLabel}>Entrenamientos</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.friendlies.attended} de {player.friendlies.possible}</span>
                  <span className={styles.statLabel}>Amistosos</span>
                  {calledButAbsentLabel(player.friendlies.calledButAbsent) && (
                    <span className={styles.statAbsentNote}>{calledButAbsentLabel(player.friendlies.calledButAbsent)}</span>
                  )}
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{player.league.attended} de {player.league.possible}</span>
                  <span className={styles.statLabel}>Liga</span>
                  {calledButAbsentLabel(player.league.calledButAbsent) && (
                    <span className={styles.statAbsentNote}>{calledButAbsentLabel(player.league.calledButAbsent)}</span>
                  )}
                </div>
              </div>

              {player.minutesPlayedPercentOfSeasonTotal != null && (
                <div className={styles.minutesTargetBlock} data-testid="squad-stat-minutes-target">
                  <div className={styles.minutesTargetHeader}>
                    <span className={styles.minutesTargetTitle}>% minutos jugados</span>
                    <span className={styles.minutesTargetGoal}>objetivo mínimo: {SEASON_MINUTES_TARGET_PERCENT}%</span>
                  </div>
                  <div className={styles.readinessBar}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressBarFill}
                        style={{ width: `${Math.min(100, Math.max(0, player.minutesPlayedPercentOfSeasonTotal))}%` }}
                      />
                      <div
                        className={styles.progressBarTarget}
                        style={{ left: `${SEASON_MINUTES_TARGET_PERCENT}%` }}
                      />
                    </div>
                    <span className={styles.readinessValue}>
                      {Math.round(player.minutesPlayedPercentOfSeasonTotal)}%
                    </span>
                  </div>
                  <span className={styles.minutesTargetCaption}>{minutesTargetCaption(player)}</span>
                </div>
              )}

              {injury && <div className={styles.injuryLine}>{injury}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
