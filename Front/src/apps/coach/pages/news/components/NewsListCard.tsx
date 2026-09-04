import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chip } from "@mui/material";
import type { NewsSummaryDto } from "../../../services/newsService";
import { useCoverImageUrl } from "../../../hooks/useCoverImageUrl";
import styles from "./NewsListCard.module.css";

interface Props {
  item: NewsSummaryDto;
  /**
   * Fixed-height variant for the team dashboard's "Últimas noticias" widget,
   * where every card (this one, EventCard, LauncherTile) must share the same
   * 220px size instead of NewsListCard's normal content-driven height (see
   * News.tsx's plain grid, which keeps the default sizing).
   */
  compact?: boolean;
}

export default function NewsListCard({ item, compact }: Props) {
  const navigate = useNavigate();
  const date = new Date(item.newsDate).toLocaleDateString("es-ES", {
    dateStyle: "medium",
  });
  const coverImageSrc = useCoverImageUrl(item.coverImageUrl);

  const openConvocation = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/coach/attendance/${item.linkedEventId}?viewConvocation=1`);
  };

  const openExternalLink = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.linkUrl) window.open(item.linkUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Link
      to={`/coach/news/${item.id}`}
      className={`${styles.card} ${compact ? styles.compact : ""}`}
    >
      {coverImageSrc && (
        <img src={coverImageSrc} alt={item.title} className={styles.image} />
      )}
      <div className={styles.content}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <div style={{ flex: 1 }}>
            <h4 className={styles.title}>{item.title}</h4>
            <p className={styles.subtitle}>{item.subtitle}</p>
          </div>
          {item.linkType === "MatchConvocation" && item.linkedEventId && (
            <Chip
              label="Convocatoria"
              size="small"
              color="primary"
              variant="outlined"
              onClick={openConvocation}
              clickable
            />
          )}
          {item.linkType === "External" && item.linkUrl && (
            <Chip
              label="Enlace"
              size="small"
              color="secondary"
              variant="outlined"
              onClick={openExternalLink}
              clickable
            />
          )}
        </div>
        <div className={styles.date}>{date}</div>
      </div>
    </Link>
  );
}
