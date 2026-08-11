import { useState, type ReactNode } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type {
  GameModel,
  Habilidad,
  Nota,
  Principle,
  SubSubPrincipio,
  Subprincipio,
  Zona,
} from "../../../types/gameModel";
import { NOTA_TIPO_LABELS, SET_PIECE_SUBTYPE_LABELS, ZONE_KEY_OPTIONS } from "../../../types/gameModel";
import { compareNumero } from "./gameModelOrder";
import styles from "./GameModelTree.module.css";

interface Props {
  gameModel: GameModel;
  /** When true, renders the print-styled variant (hidden on screen, shown only when printing). */
  print?: boolean;
}

const ZONE_LABEL_BY_KEY = Object.fromEntries(ZONE_KEY_OPTIONS.map((z) => [z.key, z.label]));

function sortByNumero<T extends { numero: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareNumero(a.numero, b.numero));
}

function zonaHeading(zona: Zona): string {
  if (zona.label) return zona.label;
  if (zona.zoneKeys.includes("compuesta") && zona.zonaTexto) return zona.zonaTexto;
  return zona.zoneKeys.map((k) => ZONE_LABEL_BY_KEY[k] ?? k).join(" / ");
}

function NotaCallout({ nota }: { nota: Nota }) {
  return (
    <p className={`${styles.nota} ${styles[`nota_${nota.tipo.replace("-", "_")}`] ?? ""}`}>
      <strong>{NOTA_TIPO_LABELS[nota.tipo]}:</strong> {nota.texto}
    </p>
  );
}

function HabilidadItem({ habilidad }: { habilidad: Habilidad }) {
  return (
    <li className={styles.habilidadItem}>
      <strong>{habilidad.nombre}</strong>
      {habilidad.referenciaAKey ? (
        <> (misma que {habilidad.referenciaAKey})</>
      ) : (
        <>
          : {habilidad.descripcion}
          {habilidad.entrenable && <> (Entrenable: {habilidad.entrenable})</>}
        </>
      )}
    </li>
  );
}

function SubSubPrincipioBlock({ ssp }: { ssp: SubSubPrincipio }) {
  return (
    <div className={styles.subSubPrincipio}>
      <p className={styles.sspTitle}>
        Sub-subprincipio {ssp.numero} — {ssp.rol}: <span className={styles.sspTexto}>{ssp.texto}</span>
      </p>
      {ssp.habilidades.length > 0 && (
        <ul className={styles.skillList}>
          {ssp.habilidades.map((h) => (
            <HabilidadItem key={h.id} habilidad={h} />
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

function SubprincipioBlock({ sp }: { sp: Subprincipio }) {
  return (
    <div className={styles.subprincipio}>
      <h4 className={styles.subprincipioTitle}>
        Subprincipio {sp.numero} — {sp.titulo}.
      </h4>
      {sp.texto && <p className={styles.texto}>{sp.texto}</p>}
      {sp.zonas.length > 0
        ? sp.zonas.map((z) => <ZonaBlock key={z.id} zona={z} />)
        : sortByNumero(sp.subSubPrincipios).map((ssp) => <SubSubPrincipioBlock key={ssp.id} ssp={ssp} />)}
      {sp.notas.map((n) => (
        <NotaCallout key={n.id} nota={n} />
      ))}
    </div>
  );
}

function PrincipleBlock({ principle }: { principle: Principle }) {
  return (
    <div className={styles.principle}>
      <h3 className={styles.principleTitle}>
        {principle.numero}. {principle.titulo}.
      </h3>
      {principle.texto && <p className={styles.texto}>{principle.texto}</p>}
      {sortByNumero(principle.subprincipios).map((sp) => (
        <SubprincipioBlock key={sp.id} sp={sp} />
      ))}
      {principle.notas.map((n) => (
        <NotaCallout key={n.id} nota={n} />
      ))}
    </div>
  );
}

function FaseSection({
  momentName,
  print,
  children,
}: {
  momentName: string;
  print: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className={styles.moment} aria-label={momentName}>
      {print ? (
        <h2 className={styles.momentTitle}>{momentName}</h2>
      ) : (
        <button
          type="button"
          className={styles.momentHeader}
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <h2 className={styles.momentTitle}>{momentName}</h2>
          <ExpandMoreIcon className={collapsed ? styles.momentChevronCollapsed : styles.momentChevron} />
        </button>
      )}
      {(print || !collapsed) && children}
    </section>
  );
}

export default function GameModelTree({ gameModel, print = false }: Props) {
  const momentIds = Array.from(new Set(gameModel.principles.map((p) => p.gameMomentId))).sort((a, b) => a - b);

  return (
    <div className={print ? styles.printRoot : styles.root}>
      {momentIds.map((momentId) => {
        const principles = gameModel.principles
          .filter((p) => p.gameMomentId === momentId)
          .sort((a, b) => a.numero - b.numero);
        const momentName = principles[0]?.gameMomentName ?? `Fase ${momentId}`;

        return (
          <FaseSection key={momentId} momentName={momentName} print={print}>
            {principles.map((p) => (
              <PrincipleBlock key={p.id} principle={p} />
            ))}
          </FaseSection>
        );
      })}

      {gameModel.setPieceRules.length > 0 && (
        <section className={styles.moment} aria-label="Balón parado">
          <h2 className={styles.momentTitle}>Balón parado</h2>
          {gameModel.setPieceRules.map((rule) => (
            <div key={rule.id} className={styles.setPieceRule}>
              <p className={styles.setPieceRuleTitle}>
                {SET_PIECE_SUBTYPE_LABELS[rule.subtype as keyof typeof SET_PIECE_SUBTYPE_LABELS] ?? rule.subtype}.
              </p>
              <p className={styles.texto}>{rule.texto}</p>
            </div>
          ))}
        </section>
      )}

      {gameModel.openIssues.length > 0 && (
        <section className={styles.moment} aria-label="Pendientes abiertos">
          <h2 className={styles.momentTitle}>Pendientes abiertos</h2>
          <ul className={styles.openIssueList}>
            {gameModel.openIssues.map((issue) => (
              <li key={issue.id} className={styles.openIssueItem}>
                <strong>{issue.topic}</strong> ({issue.status === "open" ? "pendiente" : "resuelto"}):{" "}
                {issue.description}
              </li>
            ))}
          </ul>
        </section>
      )}

      {momentIds.length === 0 && gameModel.setPieceRules.length === 0 && (
        <p className={styles.empty}>Este modelo de juego todavía no tiene contenido.</p>
      )}
    </div>
  );
}
