import { Link } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import styles from "./ClubPendingWidget.module.css";

interface ClubPendingWidgetProps {
  clubId: string;
  pendingRequests: number;
}

export default function ClubPendingWidget({ clubId, pendingRequests }: ClubPendingWidgetProps) {
  return (
    <section aria-labelledby="club-pending-title" className={styles.section}>
      <h3 id="club-pending-title" className={styles.title}>Pendiente de revisar</h3>
      {pendingRequests > 0 ? (
        <Link to={`/club-join-requests?clubId=${clubId}`} className={styles.row}>
          <span className={styles.count}>{pendingRequests}</span>
          <span className={styles.label}>Solicitudes de acceso al club</span>
          <ChevronRightIcon className={styles.chevron} aria-hidden="true" />
        </Link>
      ) : (
        <p className={styles.empty}>Nada pendiente</p>
      )}
    </section>
  );
}
