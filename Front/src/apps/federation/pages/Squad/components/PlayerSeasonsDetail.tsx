import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import PlayerSeasonStats from "../../../../../shared/components/ui/PlayerSeasonStats/PlayerSeasonStats";
import styles from "./PlayerSeasonsDetail.module.css";
import {
  getPlayerSeasonSummary,
  type PlayerSeasonSummary,
} from "../../../services/playerSeasonSummaryService";

type Props = {
  playerId: string;
  season: string;
};

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

  return <PlayerSeasonStats seasons={seasons} />;
}
