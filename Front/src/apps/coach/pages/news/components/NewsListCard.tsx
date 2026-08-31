import { Link } from "react-router-dom";
import type { NewsSummaryDto } from "../../../services/newsService";
import { useCoverImageUrl } from "../../../hooks/useCoverImageUrl";
import styles from "./NewsListCard.module.css";

interface Props {
  item: NewsSummaryDto;
}

export default function NewsListCard({ item }: Props) {
  const date = new Date(item.newsDate).toLocaleDateString("es-ES", {
    dateStyle: "medium",
  });
  const coverImageSrc = useCoverImageUrl(item.coverImageUrl);

  return (
    <Link to={`/coach/news/${item.id}`} className={styles.card}>
      {coverImageSrc && (
        <img src={coverImageSrc} alt={item.title} className={styles.image} />
      )}
      <div className={styles.content}>
        <h4 className={styles.title}>{item.title}</h4>
        <p className={styles.subtitle}>{item.subtitle}</p>
        <div className={styles.date}>{date}</div>
      </div>
    </Link>
  );
}
