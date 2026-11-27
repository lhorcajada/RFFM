import ProposalHistory, { type ProposalHistoryData } from "./ProposalHistory";
import type { ProposalSearchResult, ProposalSituation } from "../utils/proposalSearch";
import styles from "./ProposalSearch.module.css";

type Props = {
  results: ProposalSearchResult[];
  history: ProposalHistoryData;
};

const SITUATION_LABELS: Record<ProposalSituation, string> = {
  out: "Se desconvoca",
  protected: "Protegido",
  notChosen: "No elegido",
  alreadyOut: "Ya desconvocado",
};

/** Players that meet the search, each once, in place of the sections of the proposal. */
export default function ProposalSearchResults({ results, history }: Props) {
  return (
    <>
      <p className={styles.count} role="status">
        {results.length === 0
          ? "Ningún jugador cumple la búsqueda"
          : `${results.length} ${results.length === 1 ? "jugador" : "jugadores"}`}
      </p>
      {results.length > 0 && (
        <ul className={styles.results} aria-label="Resultados de la búsqueda">
          {results.map((result) => (
            <li key={result.playerId} className={styles.result}>
              <div className={styles.resultTop}>
                <strong>{result.name}</strong>
                <span className={styles.position}>{result.position}</span>
                <span className={`${styles.situation} ${result.situation === "out" ? styles.situationOut : ""}`}>
                  {SITUATION_LABELS[result.situation]}
                </span>
              </div>
              <ProposalHistory playerId={result.playerId} playerName={result.name} {...history} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
