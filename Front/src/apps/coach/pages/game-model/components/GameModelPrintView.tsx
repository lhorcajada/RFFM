import type { GameModel } from "../../../types/gameModel";
import styles from "./GameModelPrintView.module.css";

interface Props {
  gameModel: GameModel;
  teamName: string;
  season: string;
}

export default function GameModelPrintView({ gameModel, teamName, season }: Props) {
  return (
    <div className={styles.root}>
      {/* ── Cabecera ── */}
      <div className={styles.docHeader}>
        <h1 className={styles.docTitle}>{gameModel.name}</h1>
        <div className={styles.docMeta}>
          <span>{teamName}</span>
          <span className={styles.metaDivider}>·</span>
          <span>Temporada {season}</span>
        </div>
        <hr className={styles.headerRule} />
      </div>

      {/* ── Momentos de juego ── */}
      {gameModel.gameMoments.map((moment) => (
        <div key={moment.id} className={styles.moment}>
          <h2 className={styles.momentTitle}>{moment.name}</h2>

          {moment.zones.map((zone) => (
            <div key={zone.id} className={styles.zone}>
              <h3 className={styles.zoneTitle}>{zone.name}</h3>

              {zone.scenarios.length === 0 ? (
                <p className={styles.empty}>Sin escenarios definidos.</p>
              ) : (
                zone.scenarios.map((scenario) => (
                  <div key={scenario.id} className={styles.scenario}>
                    <h4 className={styles.scenarioTitle}>
                      Escenario {scenario.order}:{" "}
                      <span className={styles.scenarioName}>{scenario.name}</span>
                    </h4>
                    <p className={styles.context}>{scenario.context}</p>

                    {scenario.tacticalPrinciples.length > 0 && (
                      <p className={styles.principles}>
                        <span className={styles.principlesLabel}>
                          Principios tácticos colectivos:{" "}
                        </span>
                        {scenario.tacticalPrinciples.map((p) => p.name).join(", ")}
                      </p>
                    )}

                    {/* ── Sub-principios ── */}
                    {scenario.subPrinciples.map((sp) => (
                      <div key={sp.id} className={styles.subPrinciple}>
                        <h5 className={styles.spTitle}>
                          Subprincipio {sp.label}: {sp.name}
                        </h5>
                        <p className={styles.context}>{sp.context}</p>

                        {/* ── Sub-sub-principios ── */}
                        {sp.subSubPrinciples.map((ssp, idx) => (
                          <div key={ssp.id} className={styles.subSubPrinciple}>
                            <h6 className={styles.sspTitle}>
                              {idx + 1}. {ssp.name}
                            </h6>
                            <p className={styles.action}>{ssp.action}</p>

                            {ssp.essentialSkills.length > 0 && (
                              <div className={styles.skills}>
                                <p className={styles.skillsLabel}>
                                  Habilidades imprescindibles:
                                </p>
                                <ul className={styles.skillList}>
                                  {ssp.essentialSkills.map((skill) => (
                                    <li key={skill.id} className={styles.skillItem}>
                                      <strong>{skill.name}:</strong>{" "}
                                      {skill.description}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
