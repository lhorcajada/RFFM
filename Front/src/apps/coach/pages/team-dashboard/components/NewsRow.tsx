import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import { Link } from "react-router-dom";
import type { NewsSummaryDto } from "../../../services/newsService";
import { useCoverImageUrl } from "../../../hooks/useCoverImageUrl";
import styles from "./NewsRow.module.css";

function ageLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const distance = formatDistanceToNowStrict(date, { locale: es, roundingMethod: "floor" });
  return `Hace ${distance}`;
}

export default function NewsRow({ item }: { item: NewsSummaryDto }) {
  const coverImageSrc = useCoverImageUrl(item.coverImageUrl);
  const age = ageLabel(item.publishedAt ?? item.newsDate);

  return (
    <li>
      <Link to={`/coach/news/${item.id}`} className={styles.row}>
        <span className={styles.thumb}>
          {coverImageSrc ? (
            <img src={coverImageSrc} alt="" className={styles.image} />
          ) : (
            <NewspaperOutlinedIcon aria-hidden="true" className={styles.placeholderIcon} />
          )}
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{item.title}</span>
          {age && <span className={styles.age}>{age}</span>}
        </span>
      </Link>
    </li>
  );
}
