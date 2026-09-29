import { useEffect, useState } from "react";
import { Button, FormControlLabel, Link, Paper, Switch, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  getMatchResultNotificationPreference,
  setMatchResultNotificationPreference,
  type MatchResultNotificationPreference,
} from "../../../services/matchResultNotificationService";
import { usePushActivationStatus } from "../../../hooks/usePushActivationStatus";
import styles from "./MatchResultNotificationsToggle.module.css";

export default function MatchResultNotificationsToggle() {
  const [preference, setPreference] = useState<MatchResultNotificationPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const { shouldPrompt } = usePushActivationStatus();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    getMatchResultNotificationPreference()
      .then((loaded) => {
        if (!cancelled) setPreference(loaded);
      })
      .catch(() => {
        if (!cancelled) setPreference(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!preference) return null;

  if (!preference.teamName) {
    return (
      <Paper className={styles.card} elevation={0}>
        <Typography className={styles.hint}>
          Guarda tu equipo en{" "}
          <Link component={RouterLink} to="/federation/settings">
            Ajustes
          </Link>{" "}
          para recibir sus resultados.
        </Typography>
      </Paper>
    );
  }

  const handleChange = async (enabled: boolean) => {
    const previous = preference;
    setPreference({ ...preference, enabled });
    setSaving(true);
    try {
      await setMatchResultNotificationPreference(enabled);
    } catch {
      setPreference(previous);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: {
            message: "No se pudo guardar la preferencia de avisos de resultados",
            severity: "error",
          },
        })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper className={styles.card} elevation={0}>
      <FormControlLabel
        className={styles.toggle}
        control={
          <Switch
            checked={preference.enabled}
            disabled={saving}
            onChange={(_, checked) => void handleChange(checked)}
          />
        }
        label={`Notificarme los resultados de ${preference.teamName}`}
      />
      {shouldPrompt && (
        <div className={styles.pushHelp}>
          <Typography className={styles.hint}>
            Activa las notificaciones de este navegador para recibir los avisos.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate("/coach/settings", { state: { section: "notifications" } })}
          >
            Activar notificaciones
          </Button>
        </div>
      )}
    </Paper>
  );
}
