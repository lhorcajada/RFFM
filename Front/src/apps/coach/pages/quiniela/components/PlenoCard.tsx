import type { QuinielaMatch, QuinielaSign } from "../../../services/quinielaService";
import { PLENO_GOAL_OPTIONS } from "../quinielaHelpers";
import ChoiceGroup from "./ChoiceGroup";
import MatchPickCard from "./MatchPickCard";
import styles from "./PlenoCard.module.css";

const GOAL_OPTIONS = PLENO_GOAL_OPTIONS.map((label) => ({ value: label, label }));

type Props = {
  number: number;
  match: QuinielaMatch;
  sign: QuinielaSign | null;
  plenoHome: string | null;
  plenoAway: string | null;
  disabled: boolean;
  onSignChange: (sign: QuinielaSign) => void;
  onHomeGoalsChange: (label: string) => void;
  onAwayGoalsChange: (label: string) => void;
};

export default function PlenoCard({
  number,
  match,
  sign,
  plenoHome,
  plenoAway,
  disabled,
  onSignChange,
  onHomeGoalsChange,
  onAwayGoalsChange,
}: Props) {
  return (
    <MatchPickCard number={number} match={match} sign={sign} disabled={disabled} isPleno onSignChange={onSignChange}>
      <p className={styles.help}>Acierta los goles de cada equipo: 0, 1, 2 o M (3 o más).</p>
      <div className={styles.block}>
        <span className={styles.label}>Goles de {match.homeTeam}</span>
        <ChoiceGroup
          ariaLabel={`Goles de ${match.homeTeam}`}
          options={GOAL_OPTIONS}
          value={plenoHome}
          disabled={disabled}
          onChange={onHomeGoalsChange}
        />
        <span className={styles.label}>Goles de {match.awayTeam}</span>
        <ChoiceGroup
          ariaLabel={`Goles de ${match.awayTeam}`}
          options={GOAL_OPTIONS}
          value={plenoAway}
          disabled={disabled}
          onChange={onAwayGoalsChange}
        />
      </div>
    </MatchPickCard>
  );
}
