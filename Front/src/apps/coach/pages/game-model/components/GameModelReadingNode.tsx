import { createContext, useContext, type MouseEvent } from "react";
import { Button } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import {
  highlightSegments,
  numberMatchesQuery,
  type PendingChangeOperation,
  type ReadingNode,
} from "./gameModelReadingTree";
import styles from "./GameModelReadingNode.module.css";

export interface ReadingContextValue {
  expanded: ReadonlySet<string>;
  pinned: ReadonlySet<string>;
  tokens: string[];
  resultSet: ReadonlySet<string>;
  currentResult: string | null;
  activeAddress: string | null;
  buildHref: (address: string) => string;
  onToggle: (address: string) => void;
  onNavigate: (address: string) => void;
  onAcceptChange?: (changeId: string) => void;
  onRejectChange?: (changeId: string) => void;
}

export const ReadingContext = createContext<ReadingContextValue | null>(null);

function useReading(): ReadingContextValue {
  const value = useContext(ReadingContext);
  if (!value) throw new Error("ReadingContext is missing");
  return value;
}

export function nodeDomId(address: string): string {
  return `gm-node-${encodeURIComponent(address)}`;
}

/** Lets the browser handle modified clicks (new tab, new window) and takes over the plain ones. */
export function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, onNavigate: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onNavigate();
}

export const PENDING_LABELS: Record<PendingChangeOperation, string> = {
  add: "Propuesta: añadir",
  change: "Propuesta: modificar",
  remove: "Propuesta: eliminar",
};

function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  return (
    <>
      {highlightSegments(text, tokens).map((segment, index) =>
        segment.match ? (
          <mark key={index} className={styles.mark}>
            {segment.text}
          </mark>
        ) : (
          segment.text
        )
      )}
    </>
  );
}

function stateClassName(node: ReadingNode, context: ReadingContextValue): string {
  const names: string[] = [];
  if (context.currentResult === node.address) names.push(styles.currentResult);
  else if (context.resultSet.has(node.address)) names.push(styles.result);
  if (context.activeAddress === node.address) names.push(styles.active);
  if (node.pending) names.push(styles[`pending_${node.pending.operation}`]);
  return names.join(" ");
}

function PendingBadge({ node }: { node: ReadingNode }) {
  if (!node.pending) return null;
  return <span className={`${styles.pendingBadge} ${styles[`badge_${node.pending.operation}`]}`}>{PENDING_LABELS[node.pending.operation]}</span>;
}

/** Text of a node, highlighted only when the node is itself a search result. */
function useHighlightTokens(node: ReadingNode): { tokens: string[]; numberTokens: string[] } {
  const context = useReading();
  const isResult = context.resultSet.has(node.address);
  const tokens = isResult ? context.tokens : [];
  return { tokens, numberTokens: isResult && numberMatchesQuery(node, context.tokens) ? context.tokens : [] };
}

/** The proposed text of a node's pending change: its title and text, joined. */
function proposalText(node: ReadingNode): string {
  return [node.pending?.title, node.pending?.text].filter(Boolean).join(" · ");
}

/** The changeId of a pending change that can be decided here: it carries one and a callback is given. */
function decisionChangeId(node: ReadingNode, context: ReadingContextValue): string | undefined {
  const changeId = node.pending?.changeId;
  if (changeId === undefined) return undefined;
  return context.onAcceptChange || context.onRejectChange ? changeId : undefined;
}

/** Aceptar and Rechazar for a pending change. Renders nothing without a changeId and a callback. */
function DecisionActions({ node, showProposedText = false }: { node: ReadingNode; showProposedText?: boolean }) {
  const context = useReading();
  const { onAcceptChange, onRejectChange } = context;
  const changeId = decisionChangeId(node, context);
  if (changeId === undefined) return null;
  const text = proposalText(node);
  return (
    <span className={styles.decisions}>
      {showProposedText && text !== "" && (
        <span className={styles.proposedText}>
          <strong>Propuesta:</strong> {text}
        </span>
      )}
      {onAcceptChange && (
        <Button
          size="small"
          variant="contained"
          className={styles.decisionButton}
          disabled={node.pending?.canAccept === false}
          onClick={() => onAcceptChange(changeId)}
        >
          Aceptar
        </Button>
      )}
      {onRejectChange && (
        <Button size="small" variant="outlined" className={styles.decisionButton} onClick={() => onRejectChange(changeId)}>
          Rechazar
        </Button>
      )}
    </span>
  );
}

/** The proposed change of a node in its body: the proposed text, plus the Aceptar/Rechazar card when it can be decided. */
function ProposalBlock({ node }: { node: ReadingNode }) {
  const context = useReading();
  const text = proposalText(node);
  const decidable = decisionChangeId(node, context) !== undefined;
  if (text === "" && !decidable) return null;
  const textBlock =
    text !== "" ? (
      <p className={styles.proposal}>
        <strong>Propuesta:</strong> {text}
      </p>
    ) : null;
  if (!decidable) return textBlock;
  return (
    <div className={styles.proposalCard}>
      {textBlock}
      <DecisionActions node={node} />
    </div>
  );
}

function HabilidadItem({ node }: { node: ReadingNode }) {
  const context = useReading();
  const { tokens } = useHighlightTokens(node);
  return (
    <li id={nodeDomId(node.address)} className={`${styles.skill} ${stateClassName(node, context)}`}>
      <span className={styles.skillName}>
        <strong>
          <Highlighted text={node.title} tokens={tokens} />
        </strong>
        {node.reference && <span className={styles.skillReference}>misma que {node.reference}</span>}
        <PendingBadge node={node} />
      </span>
      {!node.reference && node.text && (
        <span className={styles.skillText}>
          <Highlighted text={node.text} tokens={tokens} />
        </span>
      )}
      {!node.reference && node.trainable && (
        <span className={styles.skillText}>
          Entrenable: <Highlighted text={node.trainable} tokens={tokens} />
        </span>
      )}
      <DecisionActions node={node} showProposedText />
    </li>
  );
}

function NotaCallout({ node }: { node: ReadingNode }) {
  const context = useReading();
  const { tokens } = useHighlightTokens(node);
  const typeClass = node.noteType ? (styles[`nota_${node.noteType.replace("-", "_")}`] ?? "") : "";
  return (
    <p id={nodeDomId(node.address)} className={`${styles.nota} ${typeClass} ${stateClassName(node, context)}`}>
      <strong className={styles.notaLabel}>
        <Highlighted text={node.title} tokens={tokens} />:
      </strong>{" "}
      <Highlighted text={node.text} tokens={tokens} /> <PendingBadge node={node} />
      <DecisionActions node={node} showProposedText />
    </p>
  );
}

function SetPieceRuleCard({ node }: { node: ReadingNode }) {
  const context = useReading();
  const { tokens } = useHighlightTokens(node);
  return (
    <article id={nodeDomId(node.address)} className={`${styles.setPieceRule} ${stateClassName(node, context)}`}>
      <h3 className={styles.setPieceTitle}>
        <Highlighted text={node.title} tokens={tokens} />
      </h3>
      <p className={styles.texto}>
        <Highlighted text={node.text} tokens={tokens} />
      </p>
      <DecisionActions node={node} showProposedText />
    </article>
  );
}

function PlaceholderCard({ node }: { node: ReadingNode }) {
  const context = useReading();
  const { tokens, numberTokens } = useHighlightTokens(node);
  return (
    <div id={nodeDomId(node.address)} className={`${styles.placeholder} ${stateClassName(node, context)}`}>
      <p className={styles.placeholderHead}>
        <PendingBadge node={node} />
        {node.number && (
          <span className={styles.numero}>
            <Highlighted text={node.number} tokens={numberTokens} />
          </span>
        )}
        <strong>
          <Highlighted text={node.title} tokens={tokens} />
        </strong>
      </p>
      {node.text && (
        <p className={styles.texto}>
          <Highlighted text={node.text} tokens={tokens} />
        </p>
      )}
      <DecisionActions node={node} />
    </div>
  );
}

function CollapsibleNode({ node }: { node: ReadingNode }) {
  const context = useReading();
  const { tokens, numberTokens } = useHighlightTokens(node);
  const expanded = context.expanded.has(node.address);
  const pinned = context.pinned.has(node.address);
  const Heading = `h${Math.min(node.level + 2, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";
  const Container: "article" | "section" | "div" =
    node.kind === "subprincipio" ? "article" : node.level <= 1 ? "section" : "div";
  const showsNumberInHeading = node.number !== undefined && node.kind !== "principle";
  const skills = node.children.filter((c) => c.kind === "habilidad");
  const others = node.children.filter((c) => c.kind !== "habilidad");

  return (
    <Container
      id={nodeDomId(node.address)}
      className={`${styles.node} ${styles[node.kind]} ${stateClassName(node, context)}`}
    >
      <div className={styles.header}>
        {node.kind === "principle" && (
          <span className={styles.badge} aria-hidden="true">
            {node.number}
          </span>
        )}
        <Heading className={`${styles.heading} ${styles[`heading_${node.kind}`]}`}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            disabled={pinned}
            onClick={() => context.onToggle(node.address)}
          >
            {showsNumberInHeading && (
              <>
                <span className={styles.numero}>
                  <Highlighted text={node.number ?? ""} tokens={numberTokens} />
                </span>{" "}
              </>
            )}
            <span className={styles.title}>
              <Highlighted text={node.title} tokens={tokens} />
            </span>
            <ExpandMoreIcon className={expanded ? styles.chevron : styles.chevronCollapsed} />
          </button>
        </Heading>
        {node.level <= 2 && (
          <a
            className={styles.link}
            href={context.buildHref(node.address)}
            aria-label={`Enlace directo a ${node.title}`}
            onClick={(event) => handleLinkClick(event, () => context.onNavigate(node.address))}
          >
            <LinkIcon fontSize="inherit" />
          </a>
        )}
        <PendingBadge node={node} />
      </div>
      {expanded && (
        <div className={styles.body}>
          {node.text && (
            <p className={styles.texto}>
              <Highlighted text={node.text} tokens={tokens} />
            </p>
          )}
          <ProposalBlock node={node} />
          {skills.length > 0 && (
            <ul className={styles.skills}>
              {skills.map((skill) => (
                <ReadingNodeView key={skill.address} node={skill} />
              ))}
            </ul>
          )}
          {others.map((child) => (
            <ReadingNodeView key={child.address} node={child} />
          ))}
        </div>
      )}
    </Container>
  );
}

export function ReadingNodeView({ node }: { node: ReadingNode }) {
  switch (node.kind) {
    case "habilidad":
      return <HabilidadItem node={node} />;
    case "nota":
      return <NotaCallout node={node} />;
    case "setPieceRule":
      return <SetPieceRuleCard node={node} />;
    case "placeholder":
      return <PlaceholderCard node={node} />;
    default:
      return <CollapsibleNode node={node} />;
  }
}
