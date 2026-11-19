import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button, Drawer, IconButton, InputAdornment, TextField } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ClearIcon from "@mui/icons-material/Clear";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ListAltIcon from "@mui/icons-material/ListAlt";
import SearchIcon from "@mui/icons-material/Search";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { useSearchParams } from "react-router-dom";
import type { GameModel } from "../../../types/gameModel";
import { NODE_LINK_PARAM } from "./gameModelNodeAddress";
import {
  ancestorAddresses,
  buildReadingTree,
  collectPinnedAddresses,
  computeExpandedAddresses,
  DEFAULT_READING_DEPTH,
  isLeafNode,
  READING_DEPTH_LEVELS,
  searchReadingTree,
  type PendingChanges,
} from "./gameModelReadingTree";
import GameModelReadingIndex from "./GameModelReadingIndex";
import { nodeDomId, ReadingContext, ReadingNodeView, type ReadingContextValue } from "./GameModelReadingNode";
import styles from "./GameModelReadingView.module.css";

interface Props {
  gameModel: GameModel;
  /** Changes proposed for nodes of the model, by node address. They only decorate the view. */
  pendingChanges?: PendingChanges;
}

const MAX_DEPTH = READING_DEPTH_LEVELS[READING_DEPTH_LEVELS.length - 1].level;

interface ScrollRequest {
  address: string;
  tick: number;
}

function withEntries(map: ReadonlyMap<string, boolean>, keys: string[], value: boolean): Map<string, boolean> {
  const next = new Map(map);
  keys.forEach((key) => next.set(key, value));
  return next;
}

function withoutEntries(map: ReadonlyMap<string, boolean>, keys: string[]): Map<string, boolean> {
  const next = new Map(map);
  keys.forEach((key) => next.delete(key));
  return next;
}

function resultsLabel(count: number, position: number): string {
  if (count === 0) return "0 resultados";
  return `${position + 1} de ${count} ${count === 1 ? "resultado" : "resultados"}`;
}

export default function GameModelReadingView({ gameModel, pendingChanges }: Props) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(DEFAULT_READING_DEPTH);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [searchToggles, setSearchToggles] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [cursor, setCursor] = useState({ query: "", index: 0 });
  const [pendingCursor, setPendingCursor] = useState(-1);
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);
  const [missingLink, setMissingLink] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tree = useMemo(() => buildReadingTree(gameModel, pendingChanges), [gameModel, pendingChanges]);
  const search = useMemo(() => searchReadingTree(tree, query), [tree, query]);
  const pinned = useMemo(() => collectPinnedAddresses(tree), [tree]);
  const resultSet = useMemo(() => new Set(search.matches), [search.matches]);
  const pendingAddresses = useMemo(() => tree.nodes.filter((n) => n.pending).map((n) => n.address), [tree]);
  const expanded = useMemo(
    () =>
      computeExpandedAddresses(tree, {
        depth,
        overrides,
        searchExpand: search.expand,
        searchToggles,
        pinned,
      }),
    [tree, depth, overrides, search.expand, searchToggles, pinned]
  );

  const isSearching = search.tokens.length > 0;
  const resultIndex = cursor.query === query ? cursor.index : 0;
  const currentResult = search.matches[resultIndex] ?? null;

  const requestScroll = useCallback((address: string) => {
    setScrollRequest((previous) => ({ address, tick: (previous?.tick ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    if (!scrollRequest) return;
    document.getElementById(nodeDomId(scrollRequest.address))?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [scrollRequest]);

  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  const reveal = useCallback(
    (address: string) => {
      const ancestors = ancestorAddresses(treeRef.current, address);
      setOverrides((previous) => withEntries(previous, ancestors, true));
      setSearchToggles((previous) => withoutEntries(previous, ancestors));
      setActiveAddress(address);
      requestScroll(address);
    },
    [requestScroll]
  );

  const nodeParam = searchParams.get(NODE_LINK_PARAM);
  useEffect(() => {
    if (!nodeParam) {
      setMissingLink(false);
      return;
    }
    const exists = treeRef.current.byAddress.has(nodeParam);
    setMissingLink(!exists);
    if (exists) reveal(nodeParam);
  }, [nodeParam, gameModel, reveal]);

  const buildHref = useCallback(
    (address: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(NODE_LINK_PARAM, address);
      return `?${params.toString()}`;
    },
    [searchParams]
  );

  const goToNode = (address: string) => {
    setDrawerOpen(false);
    if (nodeParam === address) {
      reveal(address);
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set(NODE_LINK_PARAM, address);
    setSearchParams(params, { replace: true });
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSearchToggles(new Map());
    const [firstMatch] = searchReadingTree(tree, value).matches;
    if (firstMatch) requestScroll(firstMatch);
  };

  const stepResult = (delta: number) => {
    const count = search.matches.length;
    if (count === 0) return;
    const index = (resultIndex + delta + count) % count;
    setCursor({ query, index });
    requestScroll(search.matches[index]);
  };

  const stepPending = (delta: number) => {
    const count = pendingAddresses.length;
    if (count === 0) return;
    const index = pendingCursor < 0 ? (delta > 0 ? 0 : count - 1) : (((pendingCursor % count) + delta + count) % count);
    setPendingCursor(index);
    requestScroll(pendingAddresses[index]);
  };

  const handleSearchKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    stepResult(event.shiftKey ? -1 : 1);
  };

  const toggleNode = (address: string) => {
    const toggle = (previous: ReadonlyMap<string, boolean>) => new Map(previous).set(address, !expanded.has(address));
    if (isSearching) setSearchToggles(toggle);
    else setOverrides(toggle);
  };

  const changeDepth = (level: number) => {
    setDepth(level);
    setOverrides(new Map());
    setSearchToggles(new Map());
  };

  const expandAll = () => changeDepth(MAX_DEPTH);

  const collapseAll = () => {
    const allCollapsed = new Map<string, boolean>(tree.nodes.filter((n) => !isLeafNode(n)).map((n) => [n.address, false]));
    if (isSearching) setSearchToggles(allCollapsed);
    else setOverrides(allCollapsed);
  };

  const hasIssues = gameModel.openIssues.length > 0;

  if (tree.roots.length === 0 && !hasIssues) {
    return <p className={styles.empty}>Este modelo de juego todavía no tiene contenido.</p>;
  }

  const issuesPanel = hasIssues && (
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
  );

  if (tree.roots.length === 0) {
    return (
      <div className={styles.layout}>
        <p className={styles.empty}>Este modelo de juego todavía no tiene contenido.</p>
        {issuesPanel}
      </div>
    );
  }

  const index = (
    <GameModelReadingIndex roots={tree.roots} activeAddress={activeAddress} buildHref={buildHref} onSelect={goToNode} />
  );

  const context: ReadingContextValue = {
    expanded,
    pinned,
    tokens: search.tokens,
    resultSet,
    currentResult,
    activeAddress,
    buildHref,
    onToggle: toggleNode,
    onNavigate: goToNode,
  };

  return (
    <ReadingContext.Provider value={context}>
      <div className={styles.root}>
        <div className={styles.toolbar} role="search">
          <div className={styles.searchRow}>
            <TextField
              className={styles.searchField}
              type="search"
              size="small"
              label="Buscar en el modelo"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="Borrar búsqueda" onClick={() => handleQueryChange("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
            />
            {isSearching && (
              <div className={styles.stepper}>
                <span className={styles.counter} role="status">
                  {resultsLabel(search.matches.length, resultIndex)}
                </span>
                <IconButton
                  size="small"
                  aria-label="Resultado anterior"
                  disabled={search.matches.length === 0}
                  onClick={() => stepResult(-1)}
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Resultado siguiente"
                  disabled={search.matches.length === 0}
                  onClick={() => stepResult(1)}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </div>
            )}
          </div>

          <div className={styles.controlsRow}>
            <TextField
              className={styles.depthField}
              select
              size="small"
              label="Nivel de detalle"
              value={String(depth)}
              onChange={(event) => changeDepth(Number(event.target.value))}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              {READING_DEPTH_LEVELS.map(({ level, label }) => (
                <option key={level} value={level}>
                  {label}
                </option>
              ))}
            </TextField>
            <Button size="small" variant="outlined" startIcon={<UnfoldMoreIcon />} onClick={expandAll}>
              Expandir todo
            </Button>
            <Button size="small" variant="outlined" startIcon={<UnfoldLessIcon />} onClick={collapseAll}>
              Contraer todo
            </Button>
            {isNarrow && (
              <Button size="small" variant="contained" startIcon={<ListAltIcon />} onClick={() => setDrawerOpen(true)}>
                Ir a…
              </Button>
            )}
          </div>

          {pendingAddresses.length > 0 && (
            <div className={styles.stepper}>
              <span className={styles.counter} role="status">
                {pendingAddresses.length} {pendingAddresses.length === 1 ? "cambio propuesto" : "cambios propuestos"}
              </span>
              <IconButton size="small" aria-label="Cambio propuesto anterior" onClick={() => stepPending(-1)}>
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label="Cambio propuesto siguiente" onClick={() => stepPending(1)}>
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </div>
          )}
        </div>

        <div className={styles.layout}>
          {!isNarrow && (
            <div className={styles.side}>
              {index}
              {issuesPanel}
            </div>
          )}

          <div className={styles.content}>
            {isNarrow && issuesPanel}
            {missingLink && (
              <p className={styles.notice} role="status">
                La sección enlazada ya no existe. Se muestra el modelo desde el principio.
              </p>
            )}
            {isSearching && search.matches.length === 0 && (
              <p className={styles.noResults}>No hay resultados para «{query.trim()}».</p>
            )}
            {tree.roots.map((root) => (
              <ReadingNodeView key={root.address} node={root} />
            ))}
          </div>
        </div>

        <Drawer
          anchor="left"
          open={isNarrow && drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ className: styles.drawerPaper }}
        >
          <p className={styles.drawerTitle}>Ir a…</p>
          {index}
        </Drawer>
      </div>
    </ReadingContext.Provider>
  );
}
