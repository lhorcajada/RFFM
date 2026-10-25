import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import { Link } from "react-router-dom";
import newsService, { type NewsSummaryDto } from "../../../services/newsService";
import NewsRow from "./NewsRow";
import styles from "./NewsWidget.module.css";

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

  return (
    <section aria-labelledby="news-widget-title" className={styles.container}>
      <div className={styles.header}>
        <h3 id="news-widget-title" className={styles.title}>Noticias</h3>
        <Link to="/coach/news" className={styles.headerLink}>
          Ver todas
        </Link>
      </div>
      {loading && (
        <div className={styles.loadingContainer}>
          <CircularProgress size={40} />
        </div>
      )}
      {!loading && items.length === 0 && <p className={styles.emptyState}>No hay noticias disponibles</p>}
      {!loading && items.length > 0 && (
        <ul aria-labelledby="news-widget-title" className={styles.list}>
          {items.map((item) => (
            <NewsRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
