import { Avatar, Box, Chip, Paper } from "@mui/material";
import type { ProjectedStanding } from "../../../../services/rivalStatsService";
import { formatDecimal, formatPercent } from "../simulationFormat";
import styles from "./ProjectedStandingCard.module.css";

type Props = {
  standing: ProjectedStanding;
  projectedPosition: number;
  isOwnTeam: boolean;
};

export default function ProjectedStandingCard({ standing, projectedPosition, isOwnTeam }: Props) {
  const mostLikelyProbability = standing.positionProbabilities[standing.mostLikelyPosition - 1] ?? 0;
  const distributionLabel = `Probabilidad por puesto: ${standing.positionProbabilities
    .map((p, i) => `${i + 1}º ${formatPercent(p)}`)
    .join(", ")}`;

  return (
    <Paper className={`${styles.card} ${isOwnTeam ? styles.ownTeam : ""}`} elevation={0}>
      <div className={styles.header}>
        <span className={styles.position}>{`${projectedPosition}º`}</span>
        <Avatar src={standing.shieldUrl || undefined} alt="" className={styles.shield} />
        <span className={styles.teamName}>{standing.teamName}</span>
        {isOwnTeam && <Chip size="small" color="primary" label="Tu equipo" />}
      </div>

      <div className={styles.details}>
        <span>{`Puntos: ${standing.currentPoints} → ${formatDecimal(standing.expectedPoints)}`}</span>
        <span>{`Puesto más probable: ${standing.mostLikelyPosition}º (${formatPercent(mostLikelyProbability)})`}</span>
        <span>{`Campeón: ${formatPercent(standing.championProbability)}`}</span>
      </div>

      <div className={styles.distribution} role="img" aria-label={distributionLabel}>
        {standing.positionProbabilities.map((probability, index) => (
          <Box
            key={index}
            className={styles.segment}
            sx={{ opacity: 0.08 + 0.92 * Math.min(1, probability / Math.max(mostLikelyProbability, 0.0001)) }}
          />
        ))}
      </div>
    </Paper>
  );
}
