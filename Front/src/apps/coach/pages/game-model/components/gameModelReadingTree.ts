import type {
  GameModel,
  Habilidad,
  Nota,
  NotaTipo,
  Principle,
  SubSubPrincipio,
  Subprincipio,
  Zona,
} from "../../../types/gameModel";
import { NOTA_TIPO_LABELS, SET_PIECE_SUBTYPE_LABELS } from "../../../types/gameModel";
import { compareNumero, zonaHeading } from "./gameModelOrder";
import {
  habilidadAddress,
  notaAddress,
  phaseAddress,
  principleAddress,
  SET_PIECES_ADDRESS,
  setPieceRuleAddress,
  subprincipioAddress,
  subSubPrincipioAddress,
  zonaAddress,
} from "./gameModelNodeAddress";

export type ReadingNodeKind =
  | "phase"
  | "principle"
  | "subprincipio"
  | "zona"
  | "subSubPrincipio"
  | "habilidad"
  | "nota"
  | "setPieceRule"
  | "placeholder";

export type PendingChangeOperation = "add" | "change" | "remove";

/** A change proposed for a node and not yet saved. For an `add`, `parentAddress` is the node the
 * placeholder hangs from and `number` (optional) orders it among its numbered siblings. */
export interface PendingChange {
  operation: PendingChangeOperation;
  parentAddress?: string;
  number?: string;
  title?: string;
  text?: string;
  changeId?: string;
  canAccept?: boolean;
}

/** Pending changes keyed by node address. */
export type PendingChanges = Readonly<Record<string, PendingChange>>;

export interface ReadingNode {
  address: string;
  kind: ReadingNodeKind;
  /** 0 phase, 1 principle, 2 subprincipio, 3 zona, 4 sub-subprincipio, 5 habilidad / nota. */
  level: number;
  number?: string;
  title: string;
  text: string;
  /** Habilidad only: what can be trained. */
  trainable?: string;
  /** Habilidad only: key of the habilidad this one repeats ("misma que"). */
  reference?: string;
  noteType?: NotaTipo;
  parentAddress: string | null;
  children: ReadingNode[];
  pending?: PendingChange;
}

export interface ReadingTree {
  roots: ReadingNode[];
  /** Every node in document order. */
  nodes: ReadingNode[];
  byAddress: Map<string, ReadingNode>;
}

export const READING_DEPTH_LEVELS = [
  { level: 1, label: "Principios" },
  { level: 2, label: "Subprincipios" },
  { level: 3, label: "Zonas" },
  { level: 4, label: "Sub-subprincipios" },
  { level: 5, label: "Habilidades y notas" },
] as const;

export const DEFAULT_READING_DEPTH = 2;

const LEAF_KINDS: ReadonlySet<ReadingNodeKind> = new Set(["habilidad", "nota", "setPieceRule", "placeholder"]);

export function isLeafNode(node: ReadingNode): boolean {
  return LEAF_KINDS.has(node.kind);
}

function createNode(node: Omit<ReadingNode, "text" | "children"> & Partial<Pick<ReadingNode, "text" | "children">>): ReadingNode {
  return { text: "", children: [], ...node };
}

function sortByNumero<T extends { numero: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareNumero(a.numero, b.numero));
}

function notaNode(nota: Nota, parentAddress: string): ReadingNode {
  return createNode({
    address: notaAddress(nota, parentAddress),
    kind: "nota",
    level: 5,
    title: NOTA_TIPO_LABELS[nota.tipo],
    text: nota.texto,
    noteType: nota.tipo,
    parentAddress,
  });
}

function habilidadNode(habilidad: Habilidad, parentAddress: string): ReadingNode {
  return createNode({
    address: habilidadAddress(habilidad, parentAddress),
    kind: "habilidad",
    level: 5,
    title: habilidad.nombre,
    text: habilidad.descripcion,
    trainable: habilidad.entrenable,
    reference: habilidad.referenciaAKey ?? undefined,
    parentAddress,
  });
}

function subSubPrincipioNode(ssp: SubSubPrincipio, parentAddress: string): ReadingNode {
  const address = subSubPrincipioAddress(ssp, parentAddress);
  return createNode({
    address,
    kind: "subSubPrincipio",
    level: 4,
    number: ssp.numero,
    title: ssp.rol,
    text: ssp.texto,
    parentAddress,
    children: [...ssp.habilidades.map((h) => habilidadNode(h, address)), ...ssp.notas.map((n) => notaNode(n, address))],
  });
}

function zonaNode(zona: Zona, parentAddress: string): ReadingNode {
  const address = zonaAddress(zona, parentAddress);
  return createNode({
    address,
    kind: "zona",
    level: 3,
    title: zonaHeading(zona),
    text: zona.texto,
    parentAddress,
    children: [
      ...sortByNumero(zona.subSubPrincipios).map((ssp) => subSubPrincipioNode(ssp, address)),
      ...zona.notas.map((n) => notaNode(n, address)),
    ],
  });
}

function subprincipioNode(subprincipio: Subprincipio, parentAddress: string): ReadingNode {
  const address = subprincipioAddress(subprincipio, parentAddress);
  return createNode({
    address,
    kind: "subprincipio",
    level: 2,
    number: subprincipio.numero,
    title: subprincipio.titulo,
    text: subprincipio.texto,
    parentAddress,
    children: [
      ...subprincipio.zonas.map((z) => zonaNode(z, address)),
      ...sortByNumero(subprincipio.subSubPrincipios).map((ssp) => subSubPrincipioNode(ssp, address)),
      ...subprincipio.notas.map((n) => notaNode(n, address)),
    ],
  });
}

function principleNode(principle: Principle, parentAddress: string): ReadingNode {
  const address = principleAddress(principle);
  return createNode({
    address,
    kind: "principle",
    level: 1,
    number: String(principle.numero),
    title: principle.titulo,
    text: principle.texto,
    parentAddress,
    children: [
      ...sortByNumero(principle.subprincipios).map((sp) => subprincipioNode(sp, address)),
      ...principle.notas.map((n) => notaNode(n, address)),
    ],
  });
}

function buildPhaseNodes(gameModel: GameModel): ReadingNode[] {
  const momentIds = Array.from(new Set(gameModel.principles.map((p) => p.gameMomentId))).sort((a, b) => a - b);
  const phases = momentIds.map((momentId) => {
    const principles = gameModel.principles
      .filter((p) => p.gameMomentId === momentId)
      .sort((a, b) => a.numero - b.numero);
    const address = phaseAddress(momentId);
    return createNode({
      address,
      kind: "phase",
      level: 0,
      title: principles[0]?.gameMomentName ?? `Fase ${momentId}`,
      parentAddress: null,
      children: principles.map((p) => principleNode(p, address)),
    });
  });

  if (gameModel.setPieceRules.length > 0) {
    phases.push(
      createNode({
        address: SET_PIECES_ADDRESS,
        kind: "phase",
        level: 0,
        title: "Balón parado",
        parentAddress: null,
        children: gameModel.setPieceRules.map((rule) =>
          createNode({
            address: setPieceRuleAddress(rule),
            kind: "setPieceRule",
            level: 1,
            title: SET_PIECE_SUBTYPE_LABELS[rule.subtype as keyof typeof SET_PIECE_SUBTYPE_LABELS] ?? rule.subtype,
            text: rule.texto,
            parentAddress: SET_PIECES_ADDRESS,
          })
        ),
      })
    );
  }
  return phases;
}

function finalizeTree(roots: ReadingNode[]): ReadingTree {
  const nodes: ReadingNode[] = [];
  const byAddress = new Map<string, ReadingNode>();
  const visit = (node: ReadingNode) => {
    nodes.push(node);
    byAddress.set(node.address, node);
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  return { roots, nodes, byAddress };
}

function insertPlaceholder(parent: ReadingNode, placeholder: ReadingNode) {
  const { number } = placeholder;
  const beforeNumbered = number
    ? parent.children.findIndex((c) => c.number !== undefined && compareNumero(c.number, number) > 0)
    : -1;
  const beforeNotes = parent.children.findIndex((c) => c.kind === "nota");
  const index = beforeNumbered >= 0 ? beforeNumbered : beforeNotes >= 0 ? beforeNotes : parent.children.length;
  parent.children.splice(index, 0, placeholder);
}

/** Builds the read-only view model of a game model. Pending changes decorate the view model only:
 * the saved model is never touched. */
export function buildReadingTree(gameModel: GameModel, pendingChanges: PendingChanges = {}): ReadingTree {
  const roots = buildPhaseNodes(gameModel);
  const base = finalizeTree(roots);

  for (const [address, change] of Object.entries(pendingChanges)) {
    if (change.operation !== "add") {
      const node = base.byAddress.get(address);
      if (node) node.pending = change;
      continue;
    }
    const parent = change.parentAddress ? base.byAddress.get(change.parentAddress) : undefined;
    if (!parent || isLeafNode(parent) || base.byAddress.has(address)) continue;
    insertPlaceholder(
      parent,
      createNode({
        address,
        kind: "placeholder",
        level: parent.level + 1,
        number: change.number,
        title: change.title ?? "Nuevo elemento",
        text: change.text ?? "",
        parentAddress: parent.address,
        pending: change,
      })
    );
  }

  return finalizeTree(roots);
}

/** Addresses from the root down to the parent of `address` (empty when unknown or a root). */
export function ancestorAddresses(tree: ReadingTree, address: string): string[] {
  const ancestors: string[] = [];
  let current = tree.byAddress.get(address);
  while (current?.parentAddress) {
    ancestors.unshift(current.parentAddress);
    current = tree.byAddress.get(current.parentAddress);
  }
  return ancestors;
}

/** Nodes with a pending change plus their ancestors: they must stay visible and expanded. */
export function collectPinnedAddresses(tree: ReadingTree): Set<string> {
  const pinned = new Set<string>();
  for (const node of tree.nodes) {
    if (!node.pending) continue;
    pinned.add(node.address);
    ancestorAddresses(tree, node.address).forEach((a) => pinned.add(a));
  }
  return pinned;
}

/** Children listed in the index: phase down to subprincipio, placeholders included. */
export function indexChildren(node: ReadingNode): ReadingNode[] {
  return node.children.filter(
    (c) => c.kind === "principle" || c.kind === "subprincipio" || (c.kind === "placeholder" && c.level <= 2)
  );
}

// ── Search ────────────────────────────────────────────────────────────

const COMBINING_MARKS = /\p{M}/gu;

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

export function splitSearchTokens(query: string): string[] {
  return Array.from(new Set(normalizeSearchText(query).split(/\s+/).filter(Boolean)));
}

/** True when a lone numeric query is exactly this node's number ("2.3" finds 2.3, not 2.3.1). */
export function numberMatchesQuery(node: ReadingNode, tokens: string[]): boolean {
  return node.number !== undefined && tokens.length === 1 && normalizeSearchText(node.number) === tokens[0];
}

function nodeMatches(node: ReadingNode, tokens: string[]): boolean {
  if (numberMatchesQuery(node, tokens)) return true;
  const haystack = [node.title, node.text, node.trainable ?? ""].map(normalizeSearchText).join("\n");
  return tokens.every((token) => haystack.includes(token));
}

export interface ReadingSearch {
  tokens: string[];
  /** Matching node addresses in document order. */
  matches: string[];
  /** Branches that contain a result, plus matching nodes whose own text holds it. */
  expand: Set<string>;
}

export function searchReadingTree(tree: ReadingTree, query: string): ReadingSearch {
  const tokens = splitSearchTokens(query);
  const matches: string[] = [];
  const expand = new Set<string>();
  if (tokens.length === 0) return { tokens, matches, expand };

  for (const node of tree.nodes) {
    if (!nodeMatches(node, tokens)) continue;
    matches.push(node.address);
    ancestorAddresses(tree, node.address).forEach((a) => expand.add(a));
    const normalizedText = normalizeSearchText(node.text);
    if (!isLeafNode(node) && tokens.some((token) => normalizedText.includes(token))) expand.add(node.address);
  }
  return { tokens, matches, expand };
}

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Splits `text` into segments, marking where any token occurs ignoring case and accents. The
 * segments always concatenate back to the original text. */
export function highlightSegments(text: string, tokens: string[]): TextSegment[] {
  if (tokens.length === 0 || text === "") return [{ text, match: false }];

  let folded = "";
  const originIndex: number[] = [];
  let position = 0;
  for (const char of text) {
    const foldedChar = normalizeSearchText(char);
    for (let i = 0; i < foldedChar.length; i++) originIndex.push(position);
    folded += foldedChar;
    position += char.length;
  }

  const marked = new Set<number>();
  for (const token of tokens) {
    for (let start = folded.indexOf(token); start >= 0; start = folded.indexOf(token, start + 1)) {
      for (let i = start; i < start + token.length; i++) marked.add(originIndex[i]);
    }
  }

  const segments: TextSegment[] = [];
  position = 0;
  for (const char of text) {
    const match = marked.has(position);
    const last = segments[segments.length - 1];
    if (last && last.match === match) last.text += char;
    else segments.push({ text: char, match });
    position += char.length;
  }
  return segments;
}

// ── Expansion ─────────────────────────────────────────────────────────

export interface ExpansionState {
  /** Depth level 1–5: nodes whose level is below it are expanded. */
  depth: number;
  /** Manual toggles since the last depth change. */
  overrides: ReadonlyMap<string, boolean>;
  /** Branches the active search expands. */
  searchExpand: ReadonlySet<string>;
  /** Manual toggles made while a search is active; dropped when the search changes or clears. */
  searchToggles: ReadonlyMap<string, boolean>;
  /** Nodes that must stay expanded (pending changes and their ancestors). */
  pinned: ReadonlySet<string>;
}

function isExpanded(node: ReadingNode, state: ExpansionState): boolean {
  const { address } = node;
  if (state.pinned.has(address)) return true;
  const searchToggle = state.searchToggles.get(address);
  if (searchToggle !== undefined) return searchToggle;
  if (state.searchExpand.has(address)) return true;
  const override = state.overrides.get(address);
  if (override !== undefined) return override;
  return node.level < state.depth;
}

export function computeExpandedAddresses(tree: ReadingTree, state: ExpansionState): Set<string> {
  const expanded = new Set<string>();
  for (const node of tree.nodes) {
    if (!isLeafNode(node) && isExpanded(node, state)) expanded.add(node.address);
  }
  return expanded;
}
