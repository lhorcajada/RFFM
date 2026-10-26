import type { LeaguePlayerStats } from "../../../services/leagueStatsService";
import styles from "./LeagueStatsBlock.module.css";

const LEAGUE_STATS: { key: Exclude<keyof LeaguePlayerStats, "teamPlayerId">; label: string }[] = [
  { key: "goals", label: "Goles" },
  { key: "callUps", label: "Convocatorias" },
  { key: "starts", label: "Titular" },
  { key: "yellowCards", label: "Amarillas" },
  { key: "redCards", label: "Rojas" },
  { key: "minutesPlayed", label: "Minutos" },
];

type Props = {
  stats: LeaguePlayerStats;
  hideMinutes?: boolean;
};

export default function LeagueStatsBlock({ stats, hideMinutes = false }: Props) {
  const visibleStats = hideMinutes ? LEAGUE_STATS.filter(({ key }) => key !== "minutesPlayed") : LEAGUE_STATS;

  return (
    <div className={styles.block}>
      <span className={styles.tag}>Solo liga</span>
      <div className={styles.grid}>
        {visibleStats.map(({ key, label }) => (
          <div key={key} className={styles.item}>
            <span className={styles.value}>{stats[key]}</span>
            <span className={styles.label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
