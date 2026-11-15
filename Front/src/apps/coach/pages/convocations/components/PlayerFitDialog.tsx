import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from "@mui/material";
import type { PositionFit } from "../../../types/positionFit";
import type { TraitLevel } from "../../../types/traitRating";
import { formatFitPlace, type FitInfo } from "../utils/deconvocationFunnel";
import { explainFit } from "../utils/explainFit";
import { MAX_TRAIT_LEVEL } from "../../squad/rating/ratingTraits";
import styles from "./PlayerFitDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  /** Place and value of the player in the fit order of his position. */
  fit: FitInfo | undefined;
  /** Fit order and trait weights of the player's position. */
  positionFit: PositionFit | undefined;
  /** Latest trait levels rated for the player. */
  levels: TraitLevel[];
};

const decimal = (value: number) => value.toFixed(1).replace(".", ",");

export default function PlayerFitDialog({ open, onClose, playerId, playerName, fit, positionFit, levels }: Props) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const explanation = positionFit ? explainFit(levels, positionFit.weights) : null;
  const rated = explanation?.rows.filter((row) => row.points != null) ?? [];
  const title = fit ? `Encaje de ${playerName} como ${fit.positionLabel}` : `Encaje de ${playerName}`;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen} aria-labelledby="player-fit-title">
      <DialogTitle id="player-fit-title">{title}</DialogTitle>
      <DialogContent dividers className={styles.content}>
        {fit && <p className={styles.place}>{formatFitPlace(fit)}</p>}
        <p className={styles.help}>
          El encaje es la media de los niveles (1 a 5) de los rasgos que cuentan para el puesto. Los rasgos clave pesan
          ×3 y los de suma ×1. Cuanto más alto, mejor encaja.
        </p>

        {!explanation || levels.length === 0 ? (
          <p className={styles.empty}>Aún no hay valoraciones de rasgos de este jugador.</p>
        ) : (
          <>
            <ul className={styles.traits} aria-label="Rasgos que cuentan en el puesto">
              {explanation.rows.map((row) => (
                <li key={row.traitKey} className={styles.trait}>
                  <div className={styles.traitTop}>
                    <strong className={styles.traitName}>{row.label}</strong>
                    <span className={row.weight === "key" ? styles.keyBadge : styles.sumBadge}>
                      {row.weight === "key" ? "Clave ×3" : "Suma ×1"}
                    </span>
                  </div>
                  {row.level == null ? (
                    <p className={styles.unrated}>Sin valorar</p>
                  ) : (
                    <>
                      <div className={styles.traitLevel}>
                        <span>
                          Nivel {row.level} de {MAX_TRAIT_LEVEL}
                        </span>
                        <span className={styles.points}>{row.points} pts</span>
                      </div>
                      <p className={styles.meaning}>{row.levelMeaning}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>

            {explanation.fit != null && (
              <p className={styles.formula}>
                ({rated.map((row) => row.points).join(" + ")}) ÷ {explanation.totalWeight} = {decimal(explanation.fit)}
              </p>
            )}
            {explanation.weakKeyTraits.length > 0 && (
              <p className={styles.weak}>Puntos débiles en rasgos clave: {explanation.weakKeyTraits.join(", ")}.</p>
            )}
          </>
        )}

        {positionFit && positionFit.candidates.length > 0 && (
          <section className={styles.rankingBlock}>
            <h4 className={styles.rankingTitle}>Orden del equipo en este puesto</h4>
            <ol className={styles.ranking} aria-label="Orden en el puesto">
              {positionFit.candidates.map((candidate) => {
                const current = candidate.teamPlayerId === playerId;
                return (
                  <li key={candidate.teamPlayerId} className={styles.rank} data-current={current ? "true" : undefined}>
                    <span className={styles.rankName}>{candidate.name}</span>
                    <span className={styles.rankFit}>{candidate.fit == null ? "sin datos" : decimal(candidate.fit)}</span>
                  </li>
                );
              })}
            </ol>
            {positionFit.isManual && (
              <p className={styles.manual}>El entrenador corrigió el orden a mano: puede no coincidir con el cálculo.</p>
            )}
          </section>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
