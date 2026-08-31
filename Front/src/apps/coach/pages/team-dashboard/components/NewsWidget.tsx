import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import newsService, { type NewsSummaryDto } from "../../../services/newsService";
import NewsListCard from "../../news/components/NewsListCard";
import Carousel from "../../../components/Carousel/Carousel";
import styles from "./NewsWidget.module.css";

/**
 * Auto-advance interval for the news carousel. Combined manual+automatic
 * mode (design decision, see Carousel.tsx): the user can navigate with
 * arrows/swipe at any time, which pauses auto-advance; it resumes after a
 * period of inactivity rather than staying paused until manually resumed.
 */
const AUTO_ADVANCE_MS = 5500;

export default function NewsWidget() {
  const [items, setItems] = useState<NewsSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    newsService
      .getNews(1, 3, true)
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Últimas noticias</h3>
        <div className={styles.loadingContainer}>
          <CircularProgress size={40} />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>Últimas noticias</h3>
        <p className={styles.emptyState}>No hay noticias disponibles</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Últimas noticias</h3>
      <Carousel ariaLabel="Últimas noticias" autoAdvanceMs={AUTO_ADVANCE_MS}>
        {items.map((item) => (
          <NewsListCard key={item.id} item={item} />
        ))}
      </Carousel>
    </div>
  );
}
