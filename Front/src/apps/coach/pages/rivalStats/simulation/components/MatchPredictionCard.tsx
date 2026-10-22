import { Avatar, Box, Chip, Paper } from "@mui/material";
import type { MatchPrediction } from "../../../../services/rivalStatsService";
import { formatDecimal, formatPercent } from "../simulationFormat";
import styles from "./MatchPredictionCard.module.css";

export type MatchResult = { localGoals: number; visitorGoals: number; hit: boolean };

type Props = {
  prediction: MatchPrediction;
  ownTeamCode: string | null;
  /** Resultado real de un partido ya jugado de una jornada guardada. */
  result?: MatchResult;
};

export default function MatchPredictionCard({ prediction, ownTeamCode, result }: Props) {
  const isOwnMatch =
    ownTeamCode !== null && (prediction.localTeamCode === ownTeamCode || prediction.visitorTeamCode === ownTeamCode);
  const resultClass = result ? (result.hit ? styles.hit : styles.miss) : "";

  return (
    <Paper className={`${styles.card} ${isOwnMatch ? styles.ownMatch : ""} ${resultClass}`} elevation={0}>
      {(isOwnMatch || result) && (
        <div className={styles.chips}>
          {isOwnMatch && <Chip size="small" color="primary" label="Tu equipo" />}
          {result && (
            <Chip size="small" color={result.hit ? "success" : "error"} label={result.hit ? "Acertado" : "Fallado"} />
          )}
        </div>
      )}
      <div className={styles.teams}>
        <div className={styles.team}>
          <Avatar src={prediction.localShieldUrl || undefined} alt="" className={styles.shield} />
          <span className={styles.teamName}>{prediction.localTeamName}</span>
        </div>
        <span className={styles.versus}>vs</span>
        <div className={`${styles.team} ${styles.visitor}`}>
          <Avatar src={prediction.visitorShieldUrl || undefined} alt="" className={styles.shield} />
          <span className={styles.teamName}>{prediction.visitorTeamName}</span>
        </div>
      </div>

      <div className={styles.bar} aria-hidden="true">
        <Box className={styles.home} sx={{ flexGrow: prediction.localWinProbability }} />
        <Box className={styles.draw} sx={{ flexGrow: prediction.drawProbability }} />
        <Box className={styles.away} sx={{ flexGrow: prediction.visitorWinProbability }} />
      </div>
      <div className={styles.probabilities}>
        <span>{`Gana local ${formatPercent(prediction.localWinProbability)}`}</span>
        <span>{`Empate ${formatPercent(prediction.drawProbability)}`}</span>
        <span>{`Gana visitante ${formatPercent(prediction.visitorWinProbability)}`}</span>
      </div>

      <div className={styles.details}>
        {result && (
          <span className={styles.result}>{`Resultado: ${result.localGoals} - ${result.visitorGoals}`}</span>
        )}
        <span>{`Marcador más probable: ${prediction.mostLikelyLocalGoals} - ${prediction.mostLikelyVisitorGoals}`}</span>
        <span>
          {`Goles esperados: ${formatDecimal(prediction.localExpectedGoals)} - ${formatDecimal(prediction.visitorExpectedGoals)}`}
        </span>
      </div>
    </Paper>
  );
}
