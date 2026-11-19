import { indexChildren, type ReadingNode } from "./gameModelReadingTree";
import { handleLinkClick } from "./GameModelReadingNode";
import styles from "./GameModelReadingIndex.module.css";

interface Props {
  roots: ReadingNode[];
  activeAddress: string | null;
  buildHref: (address: string) => string;
  onSelect: (address: string) => void;
}

interface ItemProps extends Omit<Props, "roots"> {
  node: ReadingNode;
}

function IndexItem({ node, activeAddress, buildHref, onSelect }: ItemProps) {
  const children = indexChildren(node);
  const isPhase = node.kind === "phase";
  return (
    <li className={styles.item}>
      <a
        className={`${styles.entry} ${styles[`level_${node.level}`] ?? ""} ${activeAddress === node.address ? styles.entryActive : ""}`}
        href={buildHref(node.address)}
        aria-current={activeAddress === node.address ? "location" : undefined}
        onClick={(event) => handleLinkClick(event, () => onSelect(node.address))}
      >
        {node.number && <span className={styles.numero}>{node.number}</span>}
        <span className={styles.title}>{node.title}</span>
        {node.pending && <span className={styles.pendingBadge}>Propuesta</span>}
        {isPhase && <span className={styles.count}>{node.children.filter((c) => c.kind !== "placeholder").length}</span>}
      </a>
      {children.length > 0 && (
        <ul className={styles.list}>
          {children.map((child) => (
            <IndexItem key={child.address} node={child} activeAddress={activeAddress} buildHref={buildHref} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function GameModelReadingIndex({ roots, activeAddress, buildHref, onSelect }: Props) {
  return (
    <nav className={styles.nav} aria-label="Índice del modelo">
      <ul className={styles.list}>
        {roots.map((root) => (
          <IndexItem key={root.address} node={root} activeAddress={activeAddress} buildHref={buildHref} onSelect={onSelect} />
        ))}
      </ul>
    </nav>
  );
}
