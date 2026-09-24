import React, { useEffect, useState } from "react";
import { FormControlLabel, Switch, Typography, Stack } from "@mui/material";
import {
  isPushNotificationsSupported,
  getCurrentPushSubscriptionStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "../../../../services/pushSubscriptionService";

function showSnackbar(message: string, severity: "success" | "error") {
  try {
    window.dispatchEvent(
      new CustomEvent("rffm.show_snackbar", { detail: { message, severity } })
    );
  } catch {
    // Ignore snackbar errors.
  }
}

const NotificationSettings: React.FC = () => {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const isSupported = isPushNotificationsSupported();
    setSupported(isSupported);
    if (!isSupported) return;

    getCurrentPushSubscriptionStatus().then(setSubscribed);
  }, []);

  const handleToggle = async () => {
    setProcessing(true);
    try {
      if (subscribed) {
        await unsubscribeFromPushNotifications();
        setSubscribed(false);
        showSnackbar("Notificaciones push desactivadas.", "success");
      } else {
        const success = await subscribeToPushNotifications();
        if (success) {
          setSubscribed(true);
          showSnackbar("Notificaciones push activadas.", "success");
        } else {
          showSnackbar(
            "No se pudieron activar las notificaciones push. Comprueba los permisos del navegador.",
            "error"
          );
        }
      }
    } catch {
      showSnackbar("No se pudo cambiar el estado de las notificaciones push.", "error");
    } finally {
      setProcessing(false);
    }
  };

  if (!supported) {
    return (
      <Typography variant="body2" color="text.secondary">
        Tu navegador no soporta notificaciones push.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Switch
            checked={subscribed}
            disabled={processing}
            onChange={() => {
              void handleToggle();
            }}
          />
        }
        label="Notificaciones push"
      />
      <Typography variant="body2" color="text.secondary">
        Recibe avisos de convocatorias, sanciones, lesiones y noticias aunque no tengas la
        aplicación abierta.
      </Typography>
    </Stack>
  );
};

export default NotificationSettings;
