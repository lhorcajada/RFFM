import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GradingOutlinedIcon from "@mui/icons-material/GradingOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import { Button } from "@mui/material";
import { exportAllPlayersPdf, exportPlayerPdf } from "../squadPdfExport";
import type { RatingSortKey } from "../squadPdfExport";
import type { PlayerRating } from "../../../types/playerRating";
import { positionAccent } from "../rating/positionCategory";
import RatingPlayerCard from "./RatingPlayerCard";
import styles from "./SquadRatings.module.css";

type PlayerEntry = {
  teamPlayerId: string;
  displayName: string;
  alias?: string | null;
  position?: string | null;
  dorsal?: number | null;
  photoSrc?: string | null;
  to?: string;
};

type Props = {
  teamId: string;
  players: PlayerEntry[];
  latestRatings: Record<string, PlayerRating>;
  onRatingCreated?: (rating: PlayerRating) => void;
  teamName?: string;
  /** When true: hides sort toolbar, PDF exports, edit/history actions, and expand panel */
  readOnly?: boolean;
};

const POSITION_ORDER = ["Portero", "Defensa", "Centrocampista", "Delantero"];

const RATING_FIELDS = [] as const;
void RATING_FIELDS; // retained for backward compat

type SortKey = RatingSortKey | "position";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "position",       label: "Posición" },
  { key: "physical",       label: "Físico" },
  { key: "technical",      label: "Técnica" },
  { key: "tactical",       label: "Táctica" },
  { key: "competitiveness", label: "Compet." },
];

function groupPlayersByPosition(
  players: PlayerEntry[],
  latestRatings: Record<string, PlayerRating>,
  sortKey: SortKey,
) {
  const groups: Record<string, PlayerEntry[]> = {};
  for (const p of players) {
    const key = p.position?.trim() || "Sin posición";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const entries = Object.entries(groups).sort(([a], [b]) => {
    const ia = POSITION_ORDER.findIndex((pos) =>
      a.toLowerCase().includes(pos.toLowerCase())
    );
    const ib = POSITION_ORDER.findIndex((pos) =>
      b.toLowerCase().includes(pos.toLowerCase())
    );
    const ra = ia === -1 ? POSITION_ORDER.length : ia;
    const rb = ib === -1 ? POSITION_ORDER.length : ib;
    return ra !== rb ? ra - rb : a.localeCompare(b, "es");
  });

  if (sortKey === "position") return entries;

  // Sort within each group by selected metric (desc), unrated go to bottom
  return entries.map(([pos, group]) => [
    pos,
    [...group].sort((a, b) => {
      const ra = latestRatings[a.teamPlayerId];
      const rb = latestRatings[b.teamPlayerId];
      if (!ra && !rb) return 0;
      if (!ra) return 1;
      if (!rb) return -1;
      return Number(rb[sortKey]) - Number(ra[sortKey]);
    }),
  ] as [string, PlayerEntry[]]);
}

function pickInitialSubRatings(_rating: PlayerRating | undefined) { return {}; }
function pickInitialKeeperSubRatings(_rating: PlayerRating | undefined) { return {}; }
function isGoalkeeperPosition(_position?: string | null): boolean { return false; }

export default function SquadRatings({ teamId: _teamId, players, latestRatings, teamName, readOnly = false }: Props) {
  const navigate = useNavigate();
  const squadSearch = window.location.search; // preserve ?teamId=...&seasonId=...
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("position");

  const grouped = useMemo(
    () => groupPlayersByPosition(players, latestRatings, sortKey),
    [players, latestRatings, sortKey],
  );

  function togglePanel(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    if (!expandedId) return;
    // El panel se abre dentro de la tarjeta; sin esto puede quedar fuera de la
    // vista en móvil y el usuario lo percibe como vacío hasta hacer scroll manual.
    const panel = document.getElementById(`sub-ratings-panel-${expandedId}`);
    if (typeof panel?.scrollIntoView === "function") {
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [expandedId]);


  if (players.length === 0) {
    return <div className={styles.empty}>No hay jugadores para valorar.</div>;
  }

  const pdfSortKey = sortKey === "position" ? undefined : sortKey;

  return (
    <div className={styles.container}>
      {!readOnly && (
        <div className={styles.toolbar}>
          <div className={styles.sortChips}>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`${styles.chip} ${sortKey === key ? styles.chipActive : ""}`}
                aria-pressed={sortKey === key}
                onClick={() => setSortKey(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className={styles.toolbarActions}>
            <Button
              variant="contained"
              startIcon={<GradingOutlinedIcon />}
              onClick={() => navigate(`/coach/squad/rating-sheet${squadSearch}`)}
              className={styles.toolbarButton}
            >
              Valorar plantilla
            </Button>

            <Button
              variant="outlined"
              startIcon={<PictureAsPdfOutlinedIcon />}
              onClick={() => exportAllPlayersPdf(players, latestRatings, teamName, pdfSortKey)}
              className={styles.toolbarButton}
            >
              PDF plantilla
            </Button>

            <Button
              variant="outlined"
              startIcon={<PictureAsPdfOutlinedIcon />}
              onClick={() => {
                for (const p of players) {
                  exportPlayerPdf(p, latestRatings[p.teamPlayerId] ?? null, teamName);
                }
              }}
              className={styles.toolbarButton}
            >
              PDF individuales
            </Button>
          </div>
        </div>
      )}
      {grouped.map(([position, group]) => {
        const accent = positionAccent(position);
        return (
          <section key={position} className={styles.positionGroup} aria-label={position}>
            <div className={styles.positionHeader}>
              <span className={styles.positionAccent} style={{ background: accent }} />
              <h2 className={styles.positionTitle}>{position}</h2>
              <span className={styles.positionCount}>{group.length}</span>
            </div>
            <div className={styles.grid}>
              {group.map((p) => (
                <RatingPlayerCard
                  key={p.teamPlayerId}
                  displayName={p.displayName}
                  alias={p.alias}
                  photoSrc={p.photoSrc}
                  dorsal={p.dorsal}
                  position={p.position}
                  rating={latestRatings[p.teamPlayerId] ?? null}
                  to={p.to}
                  expanded={expandedId === p.teamPlayerId}
                  onToggle={() => togglePanel(p.teamPlayerId)}
                  panelId={`sub-ratings-panel-${p.teamPlayerId}`}
                  onEdit={readOnly ? undefined : () => navigate(`/coach/squad/${p.teamPlayerId}/rating/new${squadSearch}`)}
                  onHistory={readOnly ? undefined : () => navigate(`/coach/squad/${p.teamPlayerId}/rating/history${squadSearch}`)}
                  onPrint={() => exportPlayerPdf(p, latestRatings[p.teamPlayerId] ?? null, teamName)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
