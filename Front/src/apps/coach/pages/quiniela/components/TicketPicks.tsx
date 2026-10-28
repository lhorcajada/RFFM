import type { QuinielaMatch, QuinielaPaymentTicket } from "../../../services/quinielaService";
import { goalsToLabel, signOfGoals } from "../quinielaHelpers";
import styles from "./TicketPicks.module.css";

type Props = {
  ticket: Pick<QuinielaPaymentTicket, "picks" | "plenoHome" | "plenoAway">;
  matches: QuinielaMatch[];
};

export default function TicketPicks({ ticket, matches }: Props) {
  const validMatches = matches.filter((m) => m.isValid);
  const signByMatch = new Map(ticket.picks.map((pick) => [pick.recordCode, pick.sign]));
  const pleno = validMatches.find((m) => m.isPleno);
  const plenoFinal = pleno?.isFinal && pleno.homeGoals !== null && pleno.awayGoals !== null;
  const plenoHit =
    plenoFinal &&
    goalsToLabel(pleno.homeGoals as number) === goalsToLabel(ticket.plenoHome) &&
    goalsToLabel(pleno.awayGoals as number) === goalsToLabel(ticket.plenoAway);

  return (
    <div className={styles.wrapper}>
      <ol className={styles.list}>
        {validMatches.map((match) => {
          const sign = signByMatch.get(match.recordCode);
          const finished = match.isFinal && match.homeGoals !== null && match.awayGoals !== null;
          const hit = finished && sign === signOfGoals(match.homeGoals as number, match.awayGoals as number);
          return (
            <li key={match.recordCode} className={styles.row} data-testid="ticket-pick">
              <span className={styles.teams}>
                <span className={styles.team}>{match.homeTeam}</span>
                <span className={styles.team}>{match.awayTeam}</span>
              </span>
              <span className={styles.outcome}>
                {finished && <span className={styles.score}>{`${match.homeGoals}-${match.awayGoals}`}</span>}
                {sign ? (
                  <span className={styles.sign} aria-label={`Pronóstico: ${sign}`}>{sign}</span>
                ) : (
                  <span className={`${styles.sign} ${styles.empty}`} aria-label="Sin pronóstico">–</span>
                )}
                {finished && sign && (
                  <span className={hit ? styles.hit : styles.miss} aria-label={hit ? "Acierto" : "Fallo"}>
                    {hit ? "✓" : "✗"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {pleno && (
        <p className={styles.pleno} aria-label="Pleno al 15">
          <span>Pleno</span>
          <strong>{`${goalsToLabel(ticket.plenoHome)} - ${goalsToLabel(ticket.plenoAway)}`}</strong>
          {plenoFinal && (
            <span className={plenoHit ? styles.hit : styles.miss} aria-label={plenoHit ? "Pleno acertado" : "Pleno fallado"}>
              {plenoHit ? "✓" : "✗"}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
