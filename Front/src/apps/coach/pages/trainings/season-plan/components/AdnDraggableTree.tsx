import { useMemo, useState, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { GameModel, Principle, Subprincipio, SubSubPrincipio, Zona } from "../../../../types/gameModel";
import type { AdnCoverage, CoverageStatus } from "../../../../types/adnCoverage";
import { compareNumero, zonaHeading } from "../../../game-model/components/gameModelOrder";
import { flattenSubprincipioTargets, summarizeTexto, toTargetDetail } from "./dragPayload";
import UsageBadge from "./UsageBadge";
import styles from "./AdnDraggableTree.module.css";

interface Props {
  gameModel: GameModel;
  /** Null while still loading — no checks/badges render until it arrives. */
  coverage: AdnCoverage | null;
}

function sortByNumero<T extends { numero: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareNumero(a.numero, b.numero));
}

/** Chevron used by every collapsible header level (Fase, Principio, Subprincipio, Zona) —
 * mirrors GameModelTree.tsx's FaseSection chevron so both trees read the same visual language. */
function Chevron({ collapsed }: { collapsed: boolean }) {
  return <ExpandMoreIcon className={collapsed ? styles.chevronCollapsed : styles.chevron} />;
}

/** Tri-state coverage icon shared by Zona/Subprincipio/Principio headings — a filled green
 * check for "completed", a partial-pie "donut" in the accent color for "in-progress" (visually
 * distinct from both the empty state and the full checkmark — reads as "started, not done"),
 * and nothing at all for "not-started" (kept clean, same convention the binary check used to
 * follow). See design.md follow-up: tri-state ADN coverage. */
function CoverageIcon({ status, testId }: { status: CoverageStatus; testId: string }) {
  if (status === "completed") return <CheckCircleIcon data-testid={testId} className={styles.checkIcon} />;
  if (status === "in-progress") return <DonutLargeIcon data-testid={testId} className={styles.progressIcon} />;
  return null;
}

/** One draggable SubSubPrincipio leaf — payload carries its single full-breadcrumb target
 * (design.md F4). Shows a derived title (`numero — rol (resumen del texto)`) plus the full
 * `texto` always visible underneath, so the coach never has to hover a tooltip to recall what
 * the role means. */
function DraggableSsp({
  ssp,
  principle,
  sp,
  zona,
  coverage,
}: {
  ssp: SubSubPrincipio;
  principle: Principle;
  sp: Subprincipio;
  zona: Zona | null;
  coverage: AdnCoverage | null;
}) {
  const id = ssp.apiId ?? "";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `subsubprincipio:${id}`,
    data: { kind: "subsubprincipio", targets: [toTargetDetail(ssp, { principle, sp, zona })] },
  });
  const style = { transform: CSS.Translate.toString(transform) };
  const usage = coverage?.subSubPrincipios.find((c) => c.subSubPrincipioId === id);
  const resumen = summarizeTexto(ssp.texto);
  const titulo = resumen ? `${ssp.numero} — ${ssp.rol} (${resumen})` : `${ssp.numero} — ${ssp.rol}`;

  return (
    <div className={styles.sspContainer}>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`${styles.sspRow} ${isDragging ? styles.dragging : ""}`}
      >
        <span data-testid={`usage-badge-${id}`}>
          <UsageBadge sessions={usage?.sessions ?? []}>
            <span>{titulo}</span>
          </UsageBadge>
        </span>
        {usage?.isUsed && <CheckCircleIcon data-testid={`covered-ssp-${id}`} className={styles.checkIcon} />}
      </div>
      {ssp.texto && <p className={styles.sspTexto}>{ssp.texto}</p>}
    </div>
  );
}

function ZonaBlock({
  zona,
  principle,
  sp,
  coverage,
}: {
  zona: Zona;
  principle: Principle;
  sp: Subprincipio;
  coverage: AdnCoverage | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const heading = zonaHeading(zona);
  const id = zona.apiId ?? "";
  const status = coverage?.zonas.find((z) => z.zonaId === id)?.status ?? "not-started";

  return (
    <div className={styles.zona}>
      <button
        type="button"
        className={styles.zonaHeader}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={heading}
      >
        <h5 className={styles.zonaTitle}>
          {heading}
          <CoverageIcon status={status} testId={`${status === "completed" ? "covered" : "progress"}-zona-${id}`} />
        </h5>
        <Chevron collapsed={collapsed} />
      </button>
      {!collapsed &&
        sortByNumero(zona.subSubPrincipios).map((ssp) => (
          <DraggableSsp key={ssp.id} ssp={ssp} principle={principle} sp={sp} zona={zona} coverage={coverage} />
        ))}
    </div>
  );
}

/** One draggable Subprincipio heading — payload carries all of its Sub-subprincipios flattened
 * (via Zonas if it has any, or direct otherwise). The drag handle and the collapse toggle are
 * separate controls in the same row so collapsing doesn't fight dnd-kit's pointer listeners. */
function DraggableSubprincipio({
  sp,
  principle,
  coverage,
}: {
  sp: Subprincipio;
  principle: Principle;
  coverage: AdnCoverage | null;
}) {
  const id = sp.apiId ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `subprincipio:${id}`,
    data: { kind: "subprincipio", targets: flattenSubprincipioTargets(sp, { principle }) },
  });
  const style = { transform: CSS.Translate.toString(transform) };
  const status = coverage?.subprincipios.find((c) => c.subprincipioId === id)?.status ?? "not-started";
  const hasChildren = sp.zonas.length > 0 || sp.subSubPrincipios.length > 0;

  return (
    <div className={styles.subprincipio}>
      <div className={styles.subprincipioHeaderRow}>
        <div
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          className={`${styles.subprincipioRow} ${isDragging ? styles.dragging : ""}`}
        >
          <span className={styles.subprincipioTitle}>
            {sp.numero} — {sp.titulo}
          </span>
          <CoverageIcon
            status={status}
            testId={`${status === "completed" ? "covered" : "progress"}-subprincipio-${id}`}
          />
        </div>
        {hasChildren && (
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expandir ${sp.numero}` : `Colapsar ${sp.numero}`}
          >
            <Chevron collapsed={collapsed} />
          </button>
        )}
      </div>
      {!collapsed &&
        (sp.zonas.length > 0
          ? sp.zonas.map((z) => <ZonaBlock key={z.id} zona={z} principle={principle} sp={sp} coverage={coverage} />)
          : sortByNumero(sp.subSubPrincipios).map((ssp) => (
              <DraggableSsp key={ssp.id} ssp={ssp} principle={principle} sp={sp} zona={null} coverage={coverage} />
            )))}
    </div>
  );
}

function PrincipleBlock({ principle, coverage }: { principle: Principle; coverage: AdnCoverage | null }) {
  const id = principle.apiId ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const status = coverage?.principios.find((c) => c.principioId === id)?.status ?? "not-started";
  const heading = `${principle.numero}. ${principle.titulo}`;

  return (
    <div className={styles.principle}>
      <button
        type="button"
        className={styles.principleHeader}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={heading}
      >
        <h3 className={styles.principleTitle}>
          {heading}
          <CoverageIcon status={status} testId={`${status === "completed" ? "covered" : "progress"}-principio-${id}`} />
        </h3>
        <Chevron collapsed={collapsed} />
      </button>
      {!collapsed &&
        sortByNumero(principle.subprincipios).map((sp) => (
          <DraggableSubprincipio key={sp.id} sp={sp} principle={principle} coverage={coverage} />
        ))}
    </div>
  );
}

function MomentSection({ momentName, children }: { momentName: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className={styles.moment} aria-label={momentName}>
      <button
        type="button"
        className={styles.momentHeader}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={momentName}
      >
        <h2 className={styles.momentTitle}>{momentName}</h2>
        <Chevron collapsed={collapsed} />
      </button>
      {!collapsed && children}
    </section>
  );
}

/** Left panel of the content-board: the team's ADN tree (Fase → Principio → Subprincipio →
 * Zona? → SubSubPrincipio), draggable at the Subprincipio and SubSubPrincipio levels, overlaid
 * with coverage checkmarks and usage badges. Mirrors `GameModelTree.tsx`'s rendering hierarchy
 * (same `compareNumero`/`zonaHeading` helpers) but is a separate component since it adds drag
 * handles + coverage overlays that `GameModelTree.tsx`'s read-only consumers don't need
 * (design.md F2 of `season-plan-content-board`). */
export default function AdnDraggableTree({ gameModel, coverage }: Props) {
  const momentIds = useMemo(
    () => Array.from(new Set(gameModel.principles.map((p) => p.gameMomentId))).sort((a, b) => a - b),
    [gameModel]
  );

  if (momentIds.length === 0) {
    return <p className={styles.empty}>Este modelo de juego todavía no tiene contenido.</p>;
  }

  return (
    <div className={styles.root}>
      {momentIds.map((momentId) => {
        const principles = gameModel.principles
          .filter((p) => p.gameMomentId === momentId)
          .sort((a, b) => a.numero - b.numero);
        const momentName = principles[0]?.gameMomentName ?? `Fase ${momentId}`;

        return (
          <MomentSection key={momentId} momentName={momentName}>
            {principles.map((p) => (
              <PrincipleBlock key={p.id} principle={p} coverage={coverage} />
            ))}
          </MomentSection>
        );
      })}
    </div>
  );
}
