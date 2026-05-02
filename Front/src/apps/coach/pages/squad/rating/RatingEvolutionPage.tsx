import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import { getTeamPlayerById } from "../../../services/teamplayerService";
import { getRatingHistory } from "../../../services/playerRatingService";
import {
  FIELD_PLAYER_CHARACTERISTICS,
  GOALKEEPER_CHARACTERISTICS,
  getCategoryLabel,
  type CategoryKey,
} from "./ratingConcepts";
import type { PlayerRating } from "../../../types/playerRating";

import styles from "./RatingEvolutionPage.module.css";

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  physical: "#3b82f6",
  technical: "#10b981",
  tactical: "#f59e0b",
  competitiveness: "#ef4444",
};

const CATEGORIES: CategoryKey[] = ["physical", "technical", "tactical", "competitiveness"];

const CHAR_COLORS = [
  "#29b6f6", "#66bb6a", "#f59e0b", "#ef5350",
  "#a78bfa", "#f472b6", "#fb923c", "#34d399", "#60a5fa",
];

function isGoalkeeperDemarcation(d?: string | null) {
  if (!d) return false;
  const l = d.toLowerCase();
  return l.includes("portero") || l.includes("keeper") || l.includes("arquero");
}

// ── SVG Line Chart ─────────────────────────────────────────────────────────────

const W = 620;
const H = 210;
const M = { top: 18, right: 16, bottom: 38, left: 34 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;
const Y_MIN = 0;
const Y_MAX = 10;
const Y_TICKS = [0, 2, 4, 6, 8, 10];

function px(i: number, n: number): number {
  if (n <= 1) return M.left + IW / 2;
  return M.left + (i / (n - 1)) * IW;
}

function py(v: number): number {
  return M.top + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * IH;
}

type Series = { label: string; color: string; values: (number | null)[] };

function LineChart({ series, xLabels }: { series: Series[]; xLabels: string[] }) {
  const n = xLabels.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chartSvg} aria-hidden="true">
      {/* Y grid */}
      {Y_TICKS.map((v) => {
        const y = py(v);
        return (
          <g key={v}>
            <line
              x1={M.left} x2={M.left + IW}
              y1={y} y2={y}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1}
            />
            <text x={M.left - 5} y={y + 4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.28)">
              {v}
            </text>
          </g>
        );
      })}

      {/* X axis baseline */}
      <line x1={M.left} x2={M.left + IW} y1={py(0)} y2={py(0)} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

      {/* X labels */}
      {xLabels.map((lbl, i) => (
        <text
          key={i}
          x={px(i, n)} y={H - M.bottom + 14}
          textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)"
        >
          {lbl}
        </text>
      ))}

      {/* Vertical tick marks for x axis */}
      {xLabels.map((_, i) => (
        <line
          key={i}
          x1={px(i, n)} x2={px(i, n)}
          y1={py(0)} y2={py(0) + 4}
          stroke="rgba(255,255,255,0.15)" strokeWidth={1}
        />
      ))}

      {/* Series */}
      {series.map((s) => (
        <g key={s.label}>
          {/* Line segments */}
          {s.values.map((v, i) => {
            if (v == null || i === 0) return null;
            let pi = i - 1;
            while (pi >= 0 && s.values[pi] == null) pi--;
            if (pi < 0 || s.values[pi] == null) return null;
            return (
              <line
                key={i}
                x1={px(pi, n)} y1={py(s.values[pi]!)}
                x2={px(i, n)} y2={py(v)}
                stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round"
              />
            );
          })}
          {/* Dots */}
          {s.values.map((v, i) =>
            v != null ? (
              <circle
                key={i}
                cx={px(i, n)} cy={py(v)}
                r={3.8}
                fill={s.color} stroke="rgba(0,0,0,0.5)" strokeWidth={1}
              />
            ) : null,
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RatingEvolutionPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const squadSearch = searchParams.toString() ? `?${searchParams.toString()}&tab=1` : "?tab=1";
  const historyPath = `/coach/squad/${playerId}/rating/history${squadSearch}`;
  const newRatingPath = `/coach/squad/${playerId}/rating/new${squadSearch}`;

  const [playerName, setPlayerName] = useState("");
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("physical");

  useEffect(() => {
    if (!playerId) return;
    Promise.all([getTeamPlayerById(playerId), getRatingHistory(playerId)]).then(([tp, history]) => {
      if (tp) {
        const name = `${tp.player?.name ?? ""} ${tp.player?.lastName ?? ""}`.trim() || tp.id;
        setPlayerName(name);
        setIsGoalkeeper(isGoalkeeperDemarcation(tp.demarcation?.activePositionName));
      }
      const sorted = [...history].sort(
        (a, b) => new Date(a.ratedAt).getTime() - new Date(b.ratedAt).getTime(),
      );
      setRatings(sorted);
      setLoading(false);
    });
  }, [playerId]);

  if (loading) {
    return (
      <BaseLayout hideFooterMenu>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </BaseLayout>
    );
  }

  const xLabels = ratings.map((r) =>
    format(new Date(r.ratedAt), "d MMM yy", { locale: es }),
  );
  const n = ratings.length;

  const categorySeries: Series[] = CATEGORIES.map((cat) => ({
    label: getCategoryLabel(cat),
    color: CATEGORY_COLORS[cat],
    values: ratings.map((r) => {
      const v = Number(r[cat]);
      return Number.isNaN(v) ? null : v;
    }),
  }));

  const characteristics = isGoalkeeper ? GOALKEEPER_CHARACTERISTICS : FIELD_PLAYER_CHARACTERISTICS;
  const catChars = characteristics.filter((c) => c.categoryKey === activeCategory);

  const charSeries: Series[] = catChars.map((char, idx) => ({
    label: char.label,
    color: CHAR_COLORS[idx % CHAR_COLORS.length],
    values: ratings.map((r) => {
      const ans = r.answers.find((a) => a.characteristicKey === char.key);
      return ans ? ans.level : null;
    }),
  }));

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={`Evolución${playerName ? ` — ${playerName}` : ""}`}
        actionBar={
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(historyPath)}
            >
              Historial
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate(newRatingPath)}
            >
              Nueva valoración
            </Button>
          </Box>
        }
      >
        {n < 2 ? (
          <Typography sx={{ opacity: 0.75, mt: 4, textAlign: "center", color: "rgba(255,255,255,0.85)" }}>
            Se necesitan al menos 2 valoraciones para mostrar la evolución.
          </Typography>
        ) : (
          <div className={styles.content}>
            {/* ── Section 1: Category overview ── */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Evolución por categoría</div>
              <div className={styles.chartCard}>
                <div className={styles.legend}>
                  {categorySeries.map((s) => (
                    <div key={s.label} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: s.color }} />
                      <span className={styles.legendLabel}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <LineChart series={categorySeries} xLabels={xLabels} />
              </div>
            </section>

            {/* ── Section 2: Per-characteristic breakdown ── */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Desglose por característica</div>
              <div className={styles.tabRow}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ""}`}
                    style={
                      activeCategory === cat
                        ? { borderBottomColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat] }
                        : {}
                    }
                    onClick={() => setActiveCategory(cat)}
                  >
                    {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>
              <div className={styles.chartCard}>
                <div className={styles.legend}>
                  {charSeries.map((s) => (
                    <div key={s.label} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: s.color }} />
                      <span className={styles.legendLabel}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <LineChart series={charSeries} xLabels={xLabels} />
              </div>
            </section>
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
