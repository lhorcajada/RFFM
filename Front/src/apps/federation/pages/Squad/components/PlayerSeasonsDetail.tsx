import React, { useEffect, useState } from "react";
import { CircularProgress, Paper, Typography } from "@mui/material";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import {
  YellowCardIcon,
  RedCardIcon,
} from "../../../../../shared/components/ui/CardIcons/CardIcons";
import styles from "./PlayerSeasonsDetail.module.css";
import {
  getPlayerSeasonSummary,
  type PlayerSeasonSummary,
  type SeasonStats,
} from "../../../services/playerSeasonSummaryService";

type Props = {
  playerId: string;
  season: string;
};

function StatItem({ label, short, value }: { label: string; short: React.ReactNode; value: number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{short}</span>
      <span className={styles.statValue} aria-label={label}>
        {value}
      </span>
    </div>
  );
}

function SeasonStatsRow({ stats }: { stats: SeasonStats }) {
  return (
    <div className={styles.stats}>
      <StatItem label="Convocatorias" short="Conv." value={stats.called} />
      <StatItem label="Titularidades" short="Tit." value={stats.starter} />
      <StatItem label="Suplencias" short="Supl." value={stats.substitute} />
      <StatItem label="Partidos jugados" short="Jug." value={stats.played} />
      <StatItem label="Goles" short="Goles" value={stats.goals} />
      <StatItem label="Amarillas" short={<YellowCardIcon />} value={stats.yellow} />
      <StatItem label="Rojas" short={<RedCardIcon />} value={stats.red + stats.doubleYellow} />
    </div>
  );
}

export default function PlayerSeasonsDetail({ playerId, season }: Props) {
  const [seasons, setSeasons] = useState<PlayerSeasonSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setSeasons(null);
    setError(false);
    getPlayerSeasonSummary(playerId, season)
      .then((data) => {
        if (mounted) setSeasons(data);
      })
      .catch(() => {
        if (mounted) setError(true);
      });
    return () => {
      mounted = false;
    };
  }, [playerId, season]);

  if (error)
    return <EmptyState description="No se pudieron cargar las estadísticas del jugador." />;

  if (seasons === null)
    return (
      <div className={styles.loading}>
        <CircularProgress size={22} color="inherit" />
      </div>
    );

  if (seasons.length === 0)
    return <EmptyState description="No hay estadísticas de este jugador en las dos últimas temporadas." />;

  return (
    <div className={styles.seasons}>
      {seasons.map((s) => {
        const label = `Temporada ${s.seasonName}`;
        return (
          <section key={s.seasonId} aria-label={label} className={styles.season}>
            <Typography component="h4" className={styles.seasonTitle}>
              {label}
            </Typography>
            <SeasonStatsRow stats={s.stats} />
            {s.teams.map((t) => (
              <Paper
                key={`${t.competitionName}-${t.groupName}-${t.teamName}`}
                className={styles.team}
                elevation={0}
              >
                <Typography className={styles.teamName}>{t.teamName}</Typography>
                <Typography className={styles.teamCategory}>
                  {t.competitionName} · {t.groupName}
                </Typography>
                <span className={styles.teamPoints}>{t.teamPoints} pts</span>
                {t.teamPosition > 0 && (
                  <span className={styles.teamPosition}>{t.teamPosition}º</span>
                )}
              </Paper>
            ))}
          </section>
        );
      })}
    </div>
  );
}
