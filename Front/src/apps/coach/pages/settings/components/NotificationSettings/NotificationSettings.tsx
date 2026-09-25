import React, { useEffect, useState } from "react";
import {
  Backdrop,
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
  Stack,
} from "@mui/material";
import {
  isPushNotificationsSupported,
  getCurrentPushSubscriptionStatus,
  requestPushPermission,
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

const DEFAULT_OPERATION_TIMEOUT_MS = 20000;

class OperationTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new OperationTimeoutError()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

type NotificationSettingsProps = {
  operationTimeoutMs?: number;
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  operationTimeoutMs = DEFAULT_OPERATION_TIMEOUT_MS,
}) => {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");

  useEffect(() => {
    const isSupported = isPushNotificationsSupported();
    setSupported(isSupported);
    if (!isSupported) return;

    getCurrentPushSubscriptionStatus().then(setSubscribed);
  }, []);

  const handleToggle = async () => {
    setProcessingMessage(
      subscribed
        ? "Desactivando notificaciones…"
        : "Activando notificaciones… Si el navegador te pide permiso, acéptalo."
    );
    setProcessing(true);
    try {
      if (subscribed) {
        await withTimeout(unsubscribeFromPushNotifications(), operationTimeoutMs);
        setSubscribed(false);
        showSnackbar("Notificaciones push desactivadas.", "success");
      } else {
        // No timeout on the permission prompt: it waits for the user, however long they take.
        const granted = await requestPushPermission();
        const success =
          granted && (await withTimeout(subscribeToPushNotifications(), operationTimeoutMs));
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
    } catch (error: unknown) {
      showSnackbar(
        error instanceof OperationTimeoutError
          ? "El navegador no ha respondido a tiempo. Inténtalo de nuevo en unos segundos."
          : "No se pudo cambiar el estado de las notificaciones push.",
        "error"
      );
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
      <Backdrop open={processing} unmountOnExit sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress color="inherit" />
          <Typography>{processingMessage}</Typography>
        </Stack>
      </Backdrop>
    </Stack>
  );
};

export default NotificationSettings;
