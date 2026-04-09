import type { PlayerRating } from "../../../types/playerRating";
import styles from "./SubRatingsPanel.module.css";

type SubItem = { key: keyof PlayerRating; label: string };
type Group = {
  catKey: "physical" | "technical" | "tactical" | "competitiveness";
  label: string;
  items: SubItem[];
};

const FIELD_GROUPS: Group[] = [
  {
    catKey: "physical",
    label: "Físico",
    items: [
      { key: "physicalSpeed", label: "Velocidad" },
      { key: "physicalEndurance", label: "Resistencia" },
      { key: "physicalStrength", label: "Fuerza" },
    ],
  },
  {
    catKey: "technical",
    label: "Técnica",
    items: [
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
    catKey: "tactical",
    label: "Táctica",
    items: [
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
    catKey: "competitiveness",
    label: "Competitividad",
    items: [
      { key: "competDuelWinning", label: "Ganador de duelos" },
      { key: "competLooseBalls", label: "Bal. divididos disp." },
      { key: "competRecoveries", label: "Recuperaciones" },
      { key: "competDecisiveActions", label: "Acciones decisivas" },
      { key: "competResponsibility", label: "Responsabilidades" },
      { key: "competConstantEffort", label: "Esfuerzo constante" },
    ],
  },
];

const KEEPER_GROUPS: Group[] = [
  {
    catKey: "physical",
    label: "Físico",
    items: [
      { key: "keeperReactionSpeed", label: "Reflejos / vel. reacción" },
      { key: "keeperAgility", label: "Agilidad" },
      { key: "keeperJumpPower", label: "Potencia de salto" },
      { key: "keeperStrength", label: "Fuerza / cuerpo a cuerpo" },
      { key: "keeperEndurance", label: "Resistencia / constancia" },
    ],
  },
  {
    catKey: "technical",
    label: "Técnica",
    items: [
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
    catKey: "tactical",
    label: "Táctica",
    items: [
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
    catKey: "competitiveness",
    label: "Competitividad",
    items: [
      { key: "keeperValor", label: "Valentía" },
      { key: "keeperConcentration", label: "Concentración" },
      { key: "keeperKeyMoments", label: "Momentos clave" },
      { key: "keeperErrorManagement", label: "Gestión del error" },
      { key: "keeperResponsibility", label: "Responsabilidad" },
      { key: "keeperConsistency", label: "Regularidad" },
    ],
  },
];

function ratingColor(v: number): string {
  if (v >= 90) return "#29b6f6";
  if (v >= 70) return "#66bb6a";
  if (v >= 50) return "#ffb300";
  return "#ef5350";
}

type Props = {
  rating: PlayerRating | null;
};

export default function SubRatingsPanel({ rating }: Props) {
  if (!rating) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Sin valoración</div>
      </div>
    );
  }

  const hasSubRatings =
    rating.isGoalkeeper
      ? rating.keeperReactionSpeed != null
      : rating.physicalSpeed != null;

  if (!hasSubRatings) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Sin desglose de subvaloraciones</div>
      </div>
    );
  }

  const groups = rating.isGoalkeeper ? KEEPER_GROUPS : FIELD_GROUPS;  return (
    <div className={styles.panel}>
      <div className={styles.groups}>
        {groups.map((group) => {
          const aggVal = Number(rating[group.catKey]);
          return (
            <div key={group.catKey} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupLabel}>{group.label}</span>
                <span
                  className={styles.groupAvg}
                  style={{ color: ratingColor(aggVal) }}
                >
                  {aggVal % 1 === 0 ? String(aggVal) : aggVal.toFixed(1)}
                </span>
              </div>
              {group.items.map(({ key, label }) => {
                const rawVal = rating[key];
                const val = rawVal != null ? Number(rawVal) : null;
                return (
                  <div key={String(key)} className={styles.item}>
                    <span className={styles.itemLabel}>{label}</span>
                    <span
                      className={styles.itemValue}
                      style={{
                        color:
                          val != null
                            ? ratingColor(val)
                            : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {val != null ? Math.round(val) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
