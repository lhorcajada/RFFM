import { useEffect, useState } from "react";
import { IconButton, LinearProgress, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import type { PlayerRating } from "../../../types/playerRating";
import playerRatingService from "../../../services/playerRatingService";
import styles from "./RatingHistoryDialog.module.css";

type Props = {
  teamPlayerId: string;
  playerDisplayName: string;
  onClose: () => void;
};

type SubItem = { key: keyof PlayerRating; label: string };

const CATEGORY_GROUPS: { key: keyof PlayerRating; label: string; subItems: SubItem[] }[] = [
  {
    key: "physical",
    label: "Físico",
    subItems: [
      { key: "physicalSpeed", label: "Velocidad" },
      { key: "physicalEndurance", label: "Resistencia" },
      { key: "physicalStrength", label: "Fuerza" },
    ],
  },
  {
    key: "technical",
    label: "Técnica",
    subItems: [
      { key: "technicalDribbling", label: "Regate" },
      { key: "technicalPassing", label: "Pase" },
      { key: "technicalControl", label: "Conducción" },
      { key: "technicalShooting", label: "Tiro" },
      { key: "technicalTackling", label: "Entradas" },
      { key: "technicalInterceptions", label: "Intercepciones" },
      { key: "technicalHeading", label: "Cabeceo" },
    ],
  },
  {
    key: "tactical",
    label: "Táctica",
    subItems: [
      { key: "tacticalDefensiveAwareness", label: "Vigilancias defensivas" },
      { key: "tacticalMarking", label: "Marcaje" },
      { key: "tacticalTrackBack", label: "Repliegue" },
      { key: "tacticalPressing", label: "Pressing" },
      { key: "tacticalGeneratesAdvantage", label: "Genera ventaja en ataque" },
      { key: "tacticalOffMovement", label: "Desmarque" },
      { key: "tacticalBeatsOpponents", label: "Supera rivales" },
      { key: "tacticalAttackParticipation", label: "Participación en ataque" },
    ],
  },
  {
    key: "competitiveness",
    label: "Competitividad",
    subItems: [
      { key: "competDuelWinning", label: "Ganador de duelos" },
      { key: "competLooseBalls", label: "Bal. div. disputados" },
      { key: "competRecoveries", label: "Recuperaciones" },
      { key: "competDecisiveActions", label: "Acciones decisivas" },
      { key: "competResponsibility", label: "Asume responsabilidades" },
      { key: "competConstantEffort", label: "Esfuerzo constante" },
    ],
  },
];

const KEEPER_CATEGORY_GROUPS: { key: keyof PlayerRating; label: string; subItems: SubItem[] }[] = [
  {
    key: "physical",
    label: "Físico",
    subItems: [
      { key: "keeperReactionSpeed", label: "Reflejos / vel. reacción" },
      { key: "keeperAgility", label: "Agilidad" },
      { key: "keeperJumpPower", label: "Potencia de salto" },
      { key: "keeperStrength", label: "Fuerza / cuerpo a cuerpo" },
      { key: "keeperEndurance", label: "Resistencia / constancia" },
    ],
  },
  {
    key: "technical",
    label: "Técnica",
    subItems: [
      { key: "keeperHandSecurity", label: "Blocaje / seguridad manos" },
      { key: "keeperSaves", label: "Paradas" },
      { key: "keeperAerialPlay", label: "Juego aéreo" },
      { key: "keeperHandDistribution", label: "Saques con mano" },
      { key: "keeperKickDistribution", label: "Saques con pie" },
      { key: "keeperFirstTouch", label: "Control / primer toque" },
      { key: "keeperPlayUnderPressure", label: "Juego con pies a presión" },
    ],
  },
  {
    key: "tactical",
    label: "Táctica",
    subItems: [
      { key: "keeperPositioning", label: "Colocación" },
      { key: "keeperGameReading", label: "Lectura de jugadas" },
      { key: "keeperOneOnOne", label: "Uno contra uno" },
      { key: "keeperBackCoverage", label: "Cobertura de espalda" },
      { key: "keeperSallyTiming", label: "Timing de salidas" },
      { key: "keeperBuildupPlay", label: "Salida de balón" },
      { key: "keeperDefensiveOrganization", label: "Orden defensivo" },
    ],
  },
  {
    key: "competitiveness",
    label: "Competitividad",
    subItems: [
      { key: "keeperValor", label: "Valentía" },
      { key: "keeperConcentration", label: "Concentración" },
      { key: "keeperKeyMoments", label: "Momentos clave" },
      { key: "keeperErrorManagement", label: "Gestión del error" },
      { key: "keeperResponsibility", label: "Responsabilidad" },
      { key: "keeperConsistency", label: "Regularidad" },
    ],
  },
];

function hasSubRatings(entry: PlayerRating): boolean {
  return entry.isGoalkeeper
    ? entry.keeperReactionSpeed != null
    : entry.physicalSpeed != null;
}

export default function RatingHistoryDialog({
  teamPlayerId,
  playerDisplayName,
  onClose,
}: Props) {
  const [history, setHistory] = useState<PlayerRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    playerRatingService
      .getRatingHistory(teamPlayerId)
      .then((data) => { if (mounted) setHistory(data); })
      .catch(() => { if (mounted) setHistory([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [teamPlayerId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              <HistoryIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
              Histórico de valoraciones
            </div>
            <div className={styles.playerName}>{playerDisplayName}</div>
          </div>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={styles.body}>
          {loading && <div className={styles.empty}>Cargando...</div>}
          {!loading && history.length === 0 && (
            <div className={styles.empty}>Sin valoraciones registradas.</div>
          )}
          {history.map((entry) => (
            <div key={entry.id} className={styles.entry}>
              <div className={styles.entryDate}>
                {new Date(entry.ratedAt).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {hasSubRatings(entry) ? (
                <div className={styles.ratingGroups}>
                  {(entry.isGoalkeeper ? KEEPER_CATEGORY_GROUPS : CATEGORY_GROUPS).map((group) => (
                    <div key={String(group.key)} className={styles.ratingGroup}>
                      <div className={styles.ratingGroupHeader}>
                        <Typography variant="caption" className={styles.ratingGroupLabel}>
                          {group.label}
                        </Typography>
                        <Typography variant="caption" className={styles.ratingGroupAvg}>
                          {Math.round(Number(entry[group.key]))}
                        </Typography>
                      </div>
                      {group.subItems.map(({ key, label }) => (
                        <div key={String(key)} className={styles.ratingItem}>
                          <Typography variant="caption" className={styles.ratingLabel}>
                            {label}
                            <span style={{ marginLeft: 4, opacity: 0.7 }}>{Math.round(Number(entry[key] ?? 0))}</span>
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Number(entry[key] ?? 0)}
                            sx={{ height: 4, borderRadius: 3 }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.ratingGrid}>
                  {CATEGORY_GROUPS.map(({ key, label }) => (
                    <div key={String(key)} className={styles.ratingItem}>
                      <Typography variant="caption" className={styles.ratingLabel}>
                        {label}
                        <span style={{ marginLeft: 4, opacity: 0.7 }}>{Math.round(Number(entry[key]))}</span>
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Number(entry[key])}
                        sx={{ height: 5, borderRadius: 3 }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {entry.notes && (
                <div className={styles.entryNotes}>{entry.notes}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
