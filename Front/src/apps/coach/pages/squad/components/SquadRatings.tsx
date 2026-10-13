import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import GradingOutlinedIcon from "@mui/icons-material/GradingOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import { Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { exportAllPlayersPdf, exportPlayerPdf } from "../squadPdfExport";
import type { RatingSortKey } from "../squadPdfExport";
import type { PlayerRating } from "../../../types/playerRating";
import { positionAccent } from "../rating/positionCategory";
import PlayerCromo from "./PlayerCromo";
import SubRatingsPanel from "./SubRatingsPanel";
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

function resolvedPlayerName(p: PlayerEntry): string {
  return p.alias?.trim() ? p.alias.trim() : p.displayName;
}

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
    // El panel aparece debajo del cromo en móvil/tablet; sin esto queda fuera
    // de la vista y el usuario lo percibe como vacío hasta hacer scroll manual.
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
          <ToggleButtonGroup
            value={sortKey}
            exclusive
            onChange={(_, v) => { if (v) setSortKey(v as SortKey); }}
            size="small"
            className={styles.sortGroup}
          >
            {SORT_OPTIONS.map(({ key, label }) => (
              <ToggleButton key={key} value={key} className={styles.sortBtn}>
                {label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <div style={{ display: "flex", gap: 8 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<GradingOutlinedIcon />}
              onClick={() => navigate(`/coach/squad/rating-sheet${squadSearch}`)}
            >
              Valorar plantilla
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdfOutlinedIcon />}
              onClick={() => exportAllPlayersPdf(players, latestRatings, teamName, pdfSortKey)}
            >
              PDF plantilla
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<PictureAsPdfOutlinedIcon />}
              onClick={() => {
                for (const p of players) {
                  exportPlayerPdf(p, latestRatings[p.teamPlayerId] ?? null, teamName);
                }
              }}
            >
              PDF individuales
            </Button>
          </div>
        </div>
      )}
      {grouped.map(([position, group]) => {
        const accent = positionAccent(position);
        return (
          <div key={position} className={styles.positionPanel}>
            <div className={styles.positionPanelAccent} style={{ background: accent }} />
            <div className={styles.positionPanelHeader}>
              <span className={styles.positionTitle}>{position}</span>
              <span className={styles.positionCount}>{group.length}</span>
            </div>
            <div className={styles.grid}>
              {group.map((p) => {
                const rating = latestRatings[p.teamPlayerId];
                const isCollapsed = expandedId !== p.teamPlayerId;
                const panelId = `sub-ratings-panel-${p.teamPlayerId}`;
                return (
                  <div key={p.teamPlayerId} className={styles.playerRow}>
                    <div className={styles.cromoCell}>
                      <PlayerCromo
                        displayName={p.displayName}
                        alias={p.alias}
                        photoSrc={p.photoSrc}
                        dorsal={p.dorsal}
                        position={p.position}
                        rating={
                          rating
                            ? {
                                technical: rating.technical,
                                tactical: rating.tactical,
                                physical: rating.physical,
                                competitiveness: rating.competitiveness,
                              }
                            : null
                        }
                        to={p.to}
                        onEdit={readOnly ? undefined : () => navigate(`/coach/squad/${p.teamPlayerId}/rating/new${squadSearch}`)}
                        onHistory={readOnly ? undefined : () => navigate(`/coach/squad/${p.teamPlayerId}/rating/history${squadSearch}`)}
                        onPrint={() => exportPlayerPdf(p, latestRatings[p.teamPlayerId] ?? null, teamName)}
                      />
                    </div>
                    <button
                      className={`${styles.toggleTab} ${!isCollapsed ? styles.toggleTabOpen : ""}`}
                      onClick={() => togglePanel(p.teamPlayerId)}
                      title={isCollapsed ? "Ver subvaloraciones" : "Ocultar subvaloraciones"}
                      aria-expanded={!isCollapsed}
                      aria-controls={panelId}
                    >
                      {isCollapsed ? (
                        <ChevronRightIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <ChevronLeftIcon sx={{ fontSize: 16 }} />
                      )}
                    </button>
                    <div
                      id={panelId}
                      className={`${styles.panelSlider} ${isCollapsed ? styles.panelSliderCollapsed : ""}`}
                      role={isCollapsed ? undefined : "region"}
                      aria-label={isCollapsed ? undefined : `Valoraciones detalladas de ${resolvedPlayerName(p)}`}
                      aria-hidden={isCollapsed}
                    >
                      {!isCollapsed && (
                        <button
                          type="button"
                          className={styles.mobileCloseBtn}
                          onClick={() => togglePanel(p.teamPlayerId)}
                          aria-label="Cerrar valoraciones"
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                          Cerrar
                        </button>
                      )}
                      <SubRatingsPanel rating={rating ?? null} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
