import type { GameModel } from "../../../types/gameModel";
import { resolveMediaUrl } from "./resolveMediaUrl";
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

              {zone.principles.length === 0 ? (
                <p className={styles.empty}>Sin escenarios definidos.</p>
              ) : (
                zone.principles.map((principle) => (
                  <div key={principle.id} className={styles.principle}>
                    <h4 className={styles.principleTitle}>Principio: {principle.title}</h4>
                    {principle.description && (
                      <p className={styles.principleDescription}>{principle.description}</p>
                    )}

                    {principle.scenarios.map((scenario) => (
                      <div key={scenario.id} className={styles.scenario}>
                        <h5 className={styles.scenarioTitle}>
                          Escenario {scenario.order}:{" "}
                          <span className={styles.scenarioName}>{scenario.name}</span>
                        </h5>
                        <p className={styles.context}>{scenario.context}</p>

                        {/* ── Foto/vídeo del escenario ── */}
                        {scenario.mediaUrl && scenario.mediaType === "image" && (
                          <img
                            src={resolveMediaUrl(scenario.mediaUrl)}
                            alt={scenario.name}
                            className={styles.scenarioMedia}
                          />
                        )}
                        {scenario.mediaUrl && scenario.mediaType === "video" && (
                          <p className={styles.mediaNote}>Vídeo disponible en la aplicación.</p>
                        )}

                        {/* ── Sub-principios ── */}
                        {scenario.subPrinciples.map((sp) => (
                          <div key={sp.id} className={styles.subPrinciple}>
                            <h6 className={styles.spTitle}>
                              Subprincipio {sp.label}: {sp.name}
                            </h6>
                            <p className={styles.context}>{sp.context}</p>

                            {/* ── Sub-sub-principios ── */}
                            {sp.subSubPrinciples.map((ssp, idx) => (
                              <div key={ssp.id} className={styles.subSubPrinciple}>
                                <p className={styles.sspTitle}>
                                  {idx + 1}. {ssp.name}
                                </p>
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
