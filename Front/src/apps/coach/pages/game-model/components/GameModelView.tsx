import { useState } from "react";
import type { GameModel, Habilidad, Nota, Principle, SubSubPrincipio, Subprincipio, Zona } from "../../../types/gameModel";
import { NOTA_TIPO_LABELS, SET_PIECE_SUBTYPE_LABELS } from "../../../types/gameModel";
import { compareNumero, zonaHeading } from "./gameModelOrder";
import styles from "./GameModelView.module.css";

interface Props {
  gameModel: GameModel;
}

const SET_PIECES_KEY = "set-pieces";

interface Phase {
  key: string;
  name: string;
  count: number;
}

function sortByNumero<T extends { numero: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareNumero(a.numero, b.numero));
}

function NotaCallout({ nota }: { nota: Nota }) {
  return (
    <p className={`${styles.nota} ${styles[`nota_${nota.tipo.replace("-", "_")}`] ?? ""}`}>
      <strong className={styles.notaLabel}>{NOTA_TIPO_LABELS[nota.tipo]}:</strong> {nota.texto}
    </p>
  );
}

function HabilidadChip({ habilidad }: { habilidad: Habilidad }) {
  return (
    <li className={styles.chip}>
      <span>{habilidad.nombre}</span>
      {habilidad.referenciaAKey && <span className={styles.chipRef}>misma que {habilidad.referenciaAKey}</span>}
    </li>
  );
}

function SubSubPrincipioBlock({ ssp }: { ssp: SubSubPrincipio }) {
  return (
    <div className={styles.ssp}>
      <p className={styles.sspHead}>
        <span className={styles.numero}>{ssp.numero}</span>
        <span className={styles.sspRole}>{ssp.rol}</span>
      </p>
      <p className={styles.texto}>{ssp.texto}</p>
      {ssp.habilidades.length > 0 && (
        <ul className={styles.chips}>
          {ssp.habilidades.map((h) => (
            <HabilidadChip key={h.id} habilidad={h} />
          ))}
        </ul>
      )}
      {ssp.notas.map((n) => (
        <NotaCallout key={n.id} nota={n} />
      ))}
    </div>
  );
}

function ZonaBlock({ zona }: { zona: Zona }) {
  return (
    <div className={styles.zona}>
      <h5 className={styles.zonaTitle}>{zonaHeading(zona)}</h5>
      {zona.texto && <p className={styles.texto}>{zona.texto}</p>}
      {sortByNumero(zona.subSubPrincipios).map((ssp) => (
        <SubSubPrincipioBlock key={ssp.id} ssp={ssp} />
      ))}
      {zona.notas.map((n) => (
        <NotaCallout key={n.id} nota={n} />
      ))}
    </div>
  );
}

function SubprincipioCard({ sp }: { sp: Subprincipio }) {
  return (
    <article className={styles.subCard}>
      <h4 className={styles.subTitle}>
        <span className={styles.numero}>{sp.numero}</span> · {sp.titulo}
      </h4>
      {sp.texto && <p className={styles.texto}>{sp.texto}</p>}
      {sp.zonas.map((z) => (
        <ZonaBlock key={z.id} zona={z} />
      ))}
      {sortByNumero(sp.subSubPrincipios).map((ssp) => (
        <SubSubPrincipioBlock key={ssp.id} ssp={ssp} />
      ))}
      {sp.notas.map((n) => (
        <NotaCallout key={n.id} nota={n} />
      ))}
    </article>
  );
}

function PrincipleCard({ principle }: { principle: Principle }) {
  return (
    <section className={styles.principleCard}>
      <div className={styles.principleHead}>
        <span className={styles.badge} aria-hidden="true">
          {principle.numero}
        </span>
        <div className={styles.principleBody}>
          <h3 className={styles.principleTitle}>{principle.titulo}</h3>
          {principle.texto && <p className={styles.texto}>{principle.texto}</p>}
        </div>
      </div>
      {principle.subprincipios.length > 0 && (
        <div className={styles.subGrid}>
          {sortByNumero(principle.subprincipios).map((sp) => (
            <SubprincipioCard key={sp.id} sp={sp} />
          ))}
        </div>
      )}
      {principle.notas.map((n) => (
        <NotaCallout key={n.id} nota={n} />
      ))}
    </section>
  );
}

export default function GameModelView({ gameModel }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const momentIds = Array.from(new Set(gameModel.principles.map((p) => p.gameMomentId))).sort((a, b) => a - b);
  const phases: Phase[] = momentIds.map((id) => {
    const principles = gameModel.principles.filter((p) => p.gameMomentId === id);
    return {
      key: `moment-${id}`,
      name: principles[0]?.gameMomentName ?? `Fase ${id}`,
      count: principles.length,
    };
  });
  if (gameModel.setPieceRules.length > 0) {
    phases.push({ key: SET_PIECES_KEY, name: "Balón parado", count: gameModel.setPieceRules.length });
  }

  const activePhase = phases.find((p) => p.key === selectedKey) ?? phases[0];
  const hasIssues = gameModel.openIssues.length > 0;

  if (!activePhase && !hasIssues) {
    return <p className={styles.empty}>Este modelo de juego todavía no tiene contenido.</p>;
  }

  const activePrinciples = activePhase?.key.startsWith("moment-")
    ? gameModel.principles
        .filter((p) => `moment-${p.gameMomentId}` === activePhase.key)
        .sort((a, b) => a.numero - b.numero)
    : [];

  return (
    <div className={styles.layout}>
      <div className={styles.side}>
        <nav className={styles.nav} aria-label="Fases del modelo">
          <span className={styles.navLabel}>Fases de juego</span>
          {phases.map((phase) => {
            const active = phase.key === activePhase?.key;
            return (
              <button
                key={phase.key}
                type="button"
                className={active ? styles.phaseButtonActive : styles.phaseButton}
                aria-pressed={active}
                onClick={() => setSelectedKey(phase.key)}
              >
                <span className={styles.phaseName}>{phase.name}</span>
                <span className={styles.phaseCount}>{phase.count}</span>
              </button>
            );
          })}
        </nav>

        {hasIssues && (
          <aside className={styles.issues} aria-label="Pendientes abiertos">
            <h3 className={styles.issuesTitle}>
              Pendientes abiertos <span className={styles.issuesCount}>{gameModel.openIssues.length}</span>
            </h3>
            <ul className={styles.issueList}>
              {gameModel.openIssues.map((issue) => (
                <li key={issue.id} className={styles.issueItem}>
                  <strong>{issue.topic}</strong>
                  <span className={styles.issueStatus}>{issue.status === "open" ? "pendiente" : "resuelto"}</span>
                  <span>{issue.description}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <div className={styles.content}>
        {activePhase ? (
          <>
            <h2 className={styles.phaseTitle}>{activePhase.name}</h2>
            {activePhase.key === SET_PIECES_KEY
              ? gameModel.setPieceRules.map((rule) => (
                  <article key={rule.id} className={styles.subCard}>
                    <h4 className={styles.subTitle}>
                      {SET_PIECE_SUBTYPE_LABELS[rule.subtype as keyof typeof SET_PIECE_SUBTYPE_LABELS] ?? rule.subtype}
                    </h4>
                    <p className={styles.texto}>{rule.texto}</p>
                  </article>
                ))
              : activePrinciples.map((p) => <PrincipleCard key={p.id} principle={p} />)}
          </>
        ) : (
          <p className={styles.empty}>Este modelo de juego todavía no tiene contenido.</p>
        )}
      </div>
    </div>
  );
}
