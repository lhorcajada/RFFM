import type { ReactNode } from "react";
import { Typography } from "@mui/material";
import type { QuinielaMatch, QuinielaSign } from "../../../services/quinielaService";
import { formatKickoff } from "../quinielaHelpers";
import ChoiceGroup from "./ChoiceGroup";
import type { ChoiceOption } from "./ChoiceGroup";
import styles from "./MatchPickCard.module.css";

const SIGN_OPTIONS: ChoiceOption[] = [
  { value: "1", label: "1", caption: "Local", ariaLabel: "1 · Local" },
  { value: "X", label: "X", caption: "Empate", ariaLabel: "X · Empate" },
  { value: "2", label: "2", caption: "Visitante", ariaLabel: "2 · Visitante" },
];

type Props = {
  number: number;
  match: QuinielaMatch;
  sign: QuinielaSign | null;
  disabled: boolean;
  isPleno?: boolean;
  onSignChange: (sign: QuinielaSign) => void;
  children?: ReactNode;
};

export default function MatchPickCard({ number, match, sign, disabled, isPleno = false, onSignChange, children }: Props) {
  const postponed = !match.isValid;
  return (
    <article
      data-testid="match-card"
      className={`${styles.card} ${isPleno ? styles.pleno : ""} ${postponed ? styles.postponed : ""}`}
    >
      <div className={styles.header}>
        <span className={styles.when}>
          <span className={`${styles.number} ${isPleno ? styles.numberPleno : ""}`}>{number}</span>
          {formatKickoff(match.kickoffUtc)}
        </span>
        {isPleno && <span className={styles.badgePleno}>Pleno</span>}
        {postponed && <span className={styles.badgePostponed}>Aplazado · no cuenta</span>}
      </div>
      <div className={styles.teams}>
        <Typography component="span" className={styles.team}>{match.homeTeam}</Typography>
        <span className={styles.versus}>vs</span>
        <Typography component="span" className={styles.team}>{match.awayTeam}</Typography>
      </div>
      {postponed ? (
        <p className={styles.postponedNote}>
          Este partido se ha aplazado. No se puede pronosticar y no puntúa en esta jornada, ni aunque se juegue después.
        </p>
      ) : (
        <>
          <ChoiceGroup
            ariaLabel={`Pronóstico ${match.homeTeam} contra ${match.awayTeam}`}
            options={SIGN_OPTIONS}
            value={sign}
            disabled={disabled}
            large
            onChange={(value) => onSignChange(value as QuinielaSign)}
          />
          {children}
        </>
      )}
    </article>
  );
}
