import { Button, Paper, Typography } from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { useNavigate } from "react-router-dom";
import { usePushActivationStatus } from "../../hooks/usePushActivationStatus";
import styles from "./PushActivationBanner.module.css";

export type PushActivationBannerVariant = "banner" | "card" | "strip" | "row";

interface PushActivationBannerProps {
  variant?: PushActivationBannerVariant;
}

const DASHBOARD_PROMPT_TEXT =
  "¿Quieres recibir las notificaciones de las convocatorias? Actívalas aquí.";

function BellBadge({ className }: { className?: string }) {
  return (
    <span className={`${styles.bellBadge} ${className ?? ""}`.trim()} aria-hidden="true">
      <NotificationsNoneOutlinedIcon className={styles.bellIcon} />
    </span>
  );
}

export default function PushActivationBanner({ variant = "banner" }: PushActivationBannerProps) {
  const { shouldPrompt } = usePushActivationStatus();
  const navigate = useNavigate();

  if (!shouldPrompt) return null;

  const goToNotificationSettings = () =>
    navigate("/coach/settings", { state: { section: "notifications" } });

  if (variant === "card") {
    return (
      <section className={styles.card} aria-label="Activar notificaciones">
        <BellBadge />
        <h3 className={styles.cardTitle}>No te pierdas nada</h3>
        <p className={styles.cardText}>{DASHBOARD_PROMPT_TEXT}</p>
        <button type="button" className={styles.cardAction} onClick={goToNotificationSettings}>
          Activar notificaciones
        </button>
      </section>
    );
  }

  if (variant === "strip") {
    return (
      <section className={styles.strip} aria-label="Activar notificaciones">
        <BellBadge className={styles.stripBadge} />
        <p className={styles.stripText}>{DASHBOARD_PROMPT_TEXT}</p>
        <button
          type="button"
          className={styles.stripAction}
          onClick={goToNotificationSettings}
          aria-label="Activar notificaciones"
        >
          Activar
        </button>
      </section>
    );
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        className={styles.row}
        onClick={goToNotificationSettings}
        aria-label="Activar notificaciones de convocatorias"
      >
        <BellBadge className={styles.rowBadge} />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>Activa las notificaciones</span>
          <span className={styles.rowSubtitle}>Recibe los avisos de las convocatorias.</span>
        </span>
        <span className={styles.rowAction}>Activar</span>
      </button>
    );
  }

  return (
    <Paper className={styles.banner} elevation={0} role="region" aria-label="Activar notificaciones">
      <NotificationsActiveIcon className={styles.icon} color="primary" />
      <Typography className={styles.text}>
        ¿Quieres recibir las notificaciones de las convocatorias? Haz clic aquí y actívalas.
      </Typography>
      <Button
        className={styles.action}
        variant="contained"
        color="primary"
        onClick={goToNotificationSettings}
      >
        Activar notificaciones
      </Button>
    </Paper>
  );
}
