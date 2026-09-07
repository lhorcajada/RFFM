import { Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { SessionTargetDetail } from "../../../types/training";
import { buildTargetTree, type SspLeaf } from "./targetTreeGrouping";
import styles from "./SessionTargetTree.module.css";

interface SessionTargetTreeProps {
  targets: SessionTargetDetail[];
  /** subSubPrincipioId → texto, built once from the team's GameModel. */
  textoMap: Map<string, string>;
  onRemove: (subSubPrincipioId: string) => void;
  /** subSubPrincipioId set of leaves used by at least one session (coverage.subSubPrincipios
   * with isUsed) — a Sub-subprincipio is a binary "completed"/"not-started" atomic unit, unlike
   * Zona/Subprincipio/Principio's tri-state, so it just gets the same "completed" checkmark
   * used elsewhere. Optional/defaults to none so callers that don't have coverage data yet keep
   * working unchanged. */
  completedSubSubPrincipioIds?: Set<string>;
}

function Leaf({
  leaf,
  textoMap,
  onRemove,
  completedSubSubPrincipioIds,
}: {
  leaf: SspLeaf;
  textoMap: Map<string, string>;
  onRemove: (id: string) => void;
  completedSubSubPrincipioIds: Set<string>;
}) {
  const { target } = leaf;
  const texto = textoMap.get(target.subSubPrincipioId);
  const isCompleted = completedSubSubPrincipioIds.has(target.subSubPrincipioId);

  return (
    <div className={styles.leaf} data-testid={`session-target-leaf-${target.subSubPrincipioId}`}>
      <div className={styles.leafRow}>
        <span className={styles.leafTitle}>
          {target.rol} ({target.numero})
        </span>
        {isCompleted && (
          <CheckCircleIcon data-testid={`covered-ssp-${target.subSubPrincipioId}`} className={styles.checkIcon} />
        )}
        <button
          type="button"
          className={styles.deleteButton}
          aria-label="Eliminar objetivo"
          onClick={() => onRemove(target.subSubPrincipioId)}
        >
          ✕
        </button>
      </div>
      {texto && <p className={styles.leafTexto}>{texto}</p>}
    </div>
  );
}

/** Right-panel, read-only rendering of a session's targets as a real Fase → Principio →
 * Subprincipio → Zona? → SubSubPrincipio tree — ancestors shared by several targets render
 * once instead of repeating a full breadcrumb per chip (replaces the flat `TargetChip` list).
 * Mirrors `AdnDraggableTree.tsx`'s hierarchy and visual language, but isn't collapsible or
 * draggable: it only reads `SessionTargetDetail[]` already on the session. See
 * openspec/changes/season-plan-content-board (follow-up: session-card target tree). */
export default function SessionTargetTree({
  targets,
  textoMap,
  onRemove,
  completedSubSubPrincipioIds = new Set(),
}: SessionTargetTreeProps) {
  if (targets.length === 0) {
    return <Typography className={styles.empty}>Arrastra un objetivo del ADN aquí</Typography>;
  }

  const fases = buildTargetTree(targets);

  return (
    <div className={styles.root}>
      {fases.map((fase) => (
        <div key={fase.gameMomentId} className={styles.fase}>
          <h4 className={styles.faseTitle}>{fase.gameMomentName}</h4>
          {fase.principios.map((principio) => (
            <div key={principio.principioId} className={styles.principio}>
              <h5 className={styles.principioTitle}>{principio.principioTitulo}</h5>
              {principio.subprincipios.map((sp) => (
                <div key={sp.subprincipioId} className={styles.subprincipio}>
                  <h6 className={styles.subprincipioTitle}>{sp.subprincipioTitulo}</h6>
                  {sp.leaves.map((leaf) => (
                    <Leaf
                      key={leaf.target.subSubPrincipioId}
                      leaf={leaf}
                      textoMap={textoMap}
                      onRemove={onRemove}
                      completedSubSubPrincipioIds={completedSubSubPrincipioIds}
                    />
                  ))}
                  {sp.zonas.map((zona) => (
                    <div key={zona.zonaId} className={styles.zona}>
                      <span className={styles.zonaTitle}>{zona.zonaLabel}</span>
                      {zona.leaves.map((leaf) => (
                        <Leaf
                          key={leaf.target.subSubPrincipioId}
                          leaf={leaf}
                          textoMap={textoMap}
                          onRemove={onRemove}
                          completedSubSubPrincipioIds={completedSubSubPrincipioIds}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
