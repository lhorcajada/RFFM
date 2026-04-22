import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import { getTeamPlayerById } from "../../../services/teamplayerService";
import { getRatingHistory } from "../../../services/playerRatingService";
import { getCategoryLabel, type CategoryKey } from "./ratingConcepts";
import type { PlayerRating, RatingAnswer } from "../../../types/playerRating";

import styles from "./RatingHistoryPage.module.css";

function levelColor(level: number): string {
  if (level >= 9) return "#29b6f6";
  if (level >= 7) return "#66bb6a";
  if (level >= 5) return "#ffb300";
  return "#ef5350";
}

function groupAnswersByCategory(answers: RatingAnswer[]): Record<CategoryKey, RatingAnswer[]> {
  const result: Partial<Record<CategoryKey, RatingAnswer[]>> = {};
  for (const a of answers) {
    const key = a.categoryKey as CategoryKey;
    if (!result[key]) result[key] = [];
    result[key]!.push(a);
  }
  return result as Record<CategoryKey, RatingAnswer[]>;
}

export default function RatingHistoryPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const squadSearch = searchParams.toString() ? `?${searchParams.toString()}&tab=1` : "?tab=1";

  const [playerName, setPlayerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!playerId) return;

    Promise.all([
      getTeamPlayerById(playerId),
      getRatingHistory(playerId),
    ]).then(([tp, history]) => {
      if (tp) {
        const name = tp.player?.firstName
          ? `${tp.player?.firstName ?? ""} ${tp.player?.lastName ?? ""}`.trim()
          : tp.id;
        setPlayerName(name);
      }
      setRatings(history);
      // Expand the latest one by default
      if (history.length > 0) {
        setExpandedIds(new Set([history[0].id]));
      }
      setLoading(false);
    });
  }, [playerId]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <BaseLayout hideFooterMenu>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <CircularProgress />
        </Box>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={`Historial de valoraciones${playerName ? ` — ${playerName}` : ""}`}
        actionBar={
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(`/coach/squad${squadSearch}`)}>
              Volver
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate(`/coach/squad/${playerId}/rating/new${squadSearch}`)}
            >
              Nueva valoración
            </Button>
          </Box>
        }
      >
        {ratings.length === 0 ? (
          <Typography sx={{ opacity: 0.5, mt: 4, textAlign: "center" }}>
            Este jugador aún no tiene valoraciones registradas.
          </Typography>
        ) : (
          <div className={styles.list}>
            {ratings.map((rating, idx) => {
              const isExpanded = expandedIds.has(rating.id);
              const catGroups = groupAnswersByCategory(rating.answers);
              const categoryKeys = Object.keys(catGroups) as CategoryKey[];
              return (
                <div key={rating.id} className={styles.ratingCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardMeta}>
                      <Typography variant="subtitle2" className={styles.dateLabel}>
                        {format(new Date(rating.ratedAt), "d MMM yyyy", { locale: es })}
                      </Typography>
                      {idx === 0 && <Chip label="Última" size="small" color="primary" sx={{ ml: 1 }} />}
                    </div>
                    <div className={styles.aggregates}>
                      {(["physical", "technical", "tactical", "competitiveness"] as CategoryKey[]).map((cat) => (
                        <div key={cat} className={styles.aggItem}>
                          <span className={styles.aggLabel}>{getCategoryLabel(cat).slice(0, 3)}.</span>
                          <span className={styles.aggValue} style={{ color: levelColor(rating[cat]) }}>
                            {Number(rating[cat]).toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Tooltip title={isExpanded ? "Colapsar" : "Expandir"}>
                      <IconButton size="small" onClick={() => toggleExpand(rating.id)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Tooltip>
                  </div>

                  <Collapse in={isExpanded}>
                    <div className={styles.detailPanel}>
                      {rating.answers.length === 0 ? (
                        <Typography variant="caption" sx={{ opacity: 0.5 }}>
                          Sin desglose de conceptos disponible.
                        </Typography>
                      ) : (
                        <div className={styles.categoryGrid}>
                          {categoryKeys.map((catKey) => (
                            <div key={catKey} className={styles.categoryCol}>
                              <div className={styles.categoryColHeader}>{getCategoryLabel(catKey)}</div>
                              {catGroups[catKey].map((answer) => (
                                <div key={answer.characteristicKey} className={styles.answerRow}>
                                  <span className={styles.answerLevel} style={{ color: levelColor(answer.level) }}>
                                    {answer.level}
                                  </span>
                                  <span className={styles.answerConcept}>{answer.concept}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {rating.notes && (
                        <div className={styles.notes}>
                          <span className={styles.notesLabel}>Notas:</span> {rating.notes}
                        </div>
                      )}
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
