import { useEffect, useState } from "react";
import { IconButton, Rating, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import type { PlayerRating } from "../../../types/playerRating";
import playerRatingService from "../../../services/playerRatingService";
import styles from "./RatingHistoryDialog.module.css";

type Props = {
  teamPlayerId: string;
  playerDisplayName: string;
  onClose: () => void;
};

const LABELS = [
  { key: "technical" as const, label: "Técnico" },
  { key: "tactical" as const, label: "Táctico" },
  { key: "physical" as const, label: "Físico" },
  { key: "competitiveness" as const, label: "Competitividad" },
];

export default function RatingHistoryDialog({
  teamPlayerId,
  playerDisplayName,
  onClose,
}: Props) {
  const [history, setHistory] = useState<PlayerRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    playerRatingService
      .getRatingHistory(teamPlayerId)
      .then((data) => { if (mounted) setHistory(data); })
      .catch(() => { if (mounted) setHistory([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [teamPlayerId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              <HistoryIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
              Histórico de valoraciones
            </div>
            <div className={styles.playerName}>{playerDisplayName}</div>
          </div>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={styles.body}>
          {loading && <div className={styles.empty}>Cargando...</div>}
          {!loading && history.length === 0 && (
            <div className={styles.empty}>Sin valoraciones registradas.</div>
          )}
          {history.map((entry) => (
            <div key={entry.id} className={styles.entry}>
              <div className={styles.entryDate}>
                {new Date(entry.ratedAt).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className={styles.ratingGrid}>
                {LABELS.map(({ key, label }) => (
                  <div key={key} className={styles.ratingItem}>
                    <Typography variant="caption" className={styles.ratingLabel}>
                      {label}
                    </Typography>
                    <Rating
                      value={entry[key]}
                      readOnly
                      size="small"
                      max={5}
                    />
                  </div>
                ))}
              </div>
              {entry.notes && (
                <div className={styles.entryNotes}>{entry.notes}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
