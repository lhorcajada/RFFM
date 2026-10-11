import type { ReactNode } from "react";
import { Paper, Typography } from "@mui/material";
import { YellowCardIcon, RedCardIcon } from "../CardIcons/CardIcons";
import styles from "./PlayerSeasonStats.module.css";

export type PlayerSeasonTotals = {
  called: number;
  starter: number;
  substitute: number;
  played: number;
  goals: number;
  yellow: number;
  red: number;
  doubleYellow: number;
};

export type PlayerSeasonTeam = {
  competitionName: string;
  groupName: string;
  teamName: string;
  teamPoints: number;
  teamPosition: number;
};

export type PlayerSeason = {
  seasonId: number;
  seasonName: string;
  stats: PlayerSeasonTotals;
  teams: PlayerSeasonTeam[];
};

function StatItem({ label, short, value }: { label: string; short: ReactNode; value: number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{short}</span>
      <span className={styles.statValue} aria-label={label}>
        {value}
      </span>
    </div>
  );
}

// A player's RFFM totals season by season, with the teams they played for in each one.
export default function PlayerSeasonStats({ seasons }: { seasons: PlayerSeason[] }) {
  return (
    <div className={styles.seasons}>
      {seasons.map((s) => {
        const label = `Temporada ${s.seasonName}`;
        return (
          <section key={s.seasonId} aria-label={label} className={styles.season}>
            <Typography component="h4" className={styles.seasonTitle}>
              {label}
            </Typography>
            <div className={styles.stats}>
              <StatItem label="Convocatorias" short="Conv." value={s.stats.called} />
              <StatItem label="Titularidades" short="Tit." value={s.stats.starter} />
              <StatItem label="Suplencias" short="Supl." value={s.stats.substitute} />
              <StatItem label="Partidos jugados" short="Jug." value={s.stats.played} />
              <StatItem label="Goles" short="Goles" value={s.stats.goals} />
              <StatItem label="Amarillas" short={<YellowCardIcon />} value={s.stats.yellow} />
              <StatItem label="Rojas" short={<RedCardIcon />} value={s.stats.red + s.stats.doubleYellow} />
            </div>
            {s.teams.map((t) => (
              <Paper key={`${t.competitionName}-${t.groupName}-${t.teamName}`} className={styles.team} elevation={0}>
                <Typography className={styles.teamName}>{t.teamName}</Typography>
                <Typography className={styles.teamCategory}>
                  {t.competitionName} · {t.groupName}
                </Typography>
                <span className={styles.teamPoints}>{t.teamPoints} pts</span>
                {t.teamPosition > 0 && <span className={styles.teamPosition}>{t.teamPosition}º</span>}
              </Paper>
            ))}
          </section>
        );
      })}
    </div>
  );
}
