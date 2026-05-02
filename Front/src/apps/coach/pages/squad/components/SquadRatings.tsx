import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import { Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { exportAllPlayersPdf, exportPlayerPdf } from "../squadPdfExport";
import type { RatingSortKey } from "../squadPdfExport";
import type { PlayerRating } from "../../../types/playerRating";
import PlayerCromo from "./PlayerCromo";
import SubRatingsPanel from "./SubRatingsPanel";
import styles from "./SquadRatings.module.css";

type PlayerEntry = {
  teamPlayerId: string;
  displayName: string;
  position?: string | null;
  dorsal?: number | null;
  photoSrc?: string | null;
};

type Props = {
  teamId: string;
  players: PlayerEntry[];
  latestRatings: Record<string, PlayerRating>;
  onRatingCreated?: (rating: PlayerRating) => void;
  teamName?: string;
};

const POSITION_ORDER = ["Portero", "Defensa", "Centrocampista", "Delantero"];

function positionCategory(position: string): number {
  const p = position.toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero") || p.includes("stopper")) return 1;
  if (p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante")) return 2;
  if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger")) return 3;
  return 4;
}

function positionAccent(position: string): string {
  const cat = positionCategory(position);
  if (cat === 0) return "#f59e0b";
  if (cat === 1) return "#3b82f6";
  if (cat === 2) return "#10b981";
  if (cat === 3) return "#ef4444";
  return "#6b7280";
}

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

export default function SquadRatings({ teamId: _teamId, players, latestRatings, teamName }: Props) {
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


  if (players.length === 0) {
    return <div className={styles.empty}>No hay jugadores para valorar.</div>;
  }

  const pdfSortKey = sortKey === "position" ? undefined : sortKey;

  return (
    <div className={styles.container}>
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
                return (
                  <div key={p.teamPlayerId} className={styles.playerRow}>
                    <div className={styles.cromoCell}>
                      <PlayerCromo
                        displayName={p.displayName}
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
                        onEdit={() => navigate(`/coach/squad/${p.teamPlayerId}/rating/new${squadSearch}`)}
                        onHistory={() => navigate(`/coach/squad/${p.teamPlayerId}/rating/history${squadSearch}`)}
                        onPrint={() => exportPlayerPdf(p, latestRatings[p.teamPlayerId] ?? null, teamName)}
                      />
                    </div>
                    <button
                      className={`${styles.toggleTab} ${!isCollapsed ? styles.toggleTabOpen : ""}`}
                      onClick={() => togglePanel(p.teamPlayerId)}
                      title={isCollapsed ? "Ver subvaloraciones" : "Ocultar subvaloraciones"}
                    >
                      {isCollapsed ? (
                        <ChevronRightIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <ChevronLeftIcon sx={{ fontSize: 16 }} />
                      )}
                    </button>
                    <div
                      className={`${styles.panelSlider} ${isCollapsed ? styles.panelSliderCollapsed : ""}`}
                    >
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
