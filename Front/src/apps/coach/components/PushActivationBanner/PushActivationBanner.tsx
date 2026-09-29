import { Button, Paper, Typography } from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { useNavigate } from "react-router-dom";
import { usePushActivationStatus } from "../../hooks/usePushActivationStatus";
import styles from "./PushActivationBanner.module.css";

export default function PushActivationBanner() {
  const { shouldPrompt } = usePushActivationStatus();
  const navigate = useNavigate();

  if (!shouldPrompt) return null;

  const goToNotificationSettings = () =>
    navigate("/coach/settings", { state: { section: "notifications" } });

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
