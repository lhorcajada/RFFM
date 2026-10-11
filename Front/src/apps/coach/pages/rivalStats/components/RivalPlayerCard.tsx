import { Paper, Typography } from "@mui/material";
import PlayerSeasonStats from "../../../../../shared/components/ui/PlayerSeasonStats/PlayerSeasonStats";
import type { RivalPlayer } from "../../../services/rivalStatsService";
import styles from "./RivalPlayerCard.module.css";

export default function RivalPlayerCard({ player }: { player: RivalPlayer }) {
  const details = [player.birthYear, player.position].filter(Boolean).join(" · ");

  return (
    <Paper className={styles.card} elevation={0}>
      <div className={styles.header}>
        <Typography component="h3" className={styles.name}>
          {player.playerName}
        </Typography>
        {details && <span className={styles.details}>{details}</span>}
      </div>
      {player.seasons.length > 0 ? (
        <PlayerSeasonStats seasons={player.seasons} />
      ) : (
        <Typography className={styles.empty}>Sin estadísticas en las dos últimas temporadas.</Typography>
      )}
    </Paper>
  );
}
