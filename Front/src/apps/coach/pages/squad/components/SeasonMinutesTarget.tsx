import { Typography } from "@mui/material";
import type { MinutesTargetStatus, PlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import { SEASON_MINUTES_TARGET_PERCENT } from "../../../services/teamPlayerStatisticsService";
import { minutesTargetVerdict } from "../playerStatsText";
import styles from "./SeasonMinutesTarget.module.css";

type Props = {
  player: PlayerStatistics;
};

const VERDICT_COLORS: Record<MinutesTargetStatus, "success.main" | "warning.main" | "error.main"> = {
  Met: "success.main",
  NotMetByOwnAbsences: "warning.main",
  NotMet: "error.main",
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export default function SeasonMinutesTarget({ player }: Props) {
  const played = clampPercent(player.minutesPlayedPercentOfSeasonTotal ?? 0);
  const absent = Math.min(100 - played, clampPercent(player.attributableAbsentMinutesPercentOfSeasonTotal ?? 0));
  const verdict = minutesTargetVerdict(player);

  return (
    <div className={styles.block} data-testid="squad-stat-minutes-target">
      <div className={styles.header}>
        <span className={styles.title}>% minutos jugados</span>
        <span className={styles.goal}>objetivo mínimo: {SEASON_MINUTES_TARGET_PERCENT}%</span>
      </div>
      <div className={styles.barRow}>
        <div className={styles.bar}>
          <div className={styles.barPlayed} style={{ width: `${played}%` }} />
          {absent > 0 && (
            <div
              className={styles.barAbsent}
              style={{ width: `${absent}%` }}
              data-testid="minutes-target-absent-segment"
              title="Minutos perdidos por sus ausencias"
            />
          )}
          <div className={styles.barTarget} style={{ left: `${SEASON_MINUTES_TARGET_PERCENT}%` }} />
        </div>
        <span className={styles.value}>{Math.round(played)}%</span>
      </div>
      {verdict && player.minutesTargetStatus && (
        <Typography variant="caption" className={styles.verdict} sx={{ color: VERDICT_COLORS[player.minutesTargetStatus] }}>
          {verdict}
        </Typography>
      )}
    </div>
  );
}
