import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import styles from "./Login.module.css";
import { useCoachAuthContext } from "../../../../apps/coach/context/CoachAuthContext";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import { resetClientState } from "../../../../core/diagnostics/resetClientState";
import { formatAuthTrace, traceAuth } from "../../../../core/diagnostics/authTrace";

type SharedLoginProps = {
  redirectTo?: string;
  onReload?: () => void;
};

const reloadLogin = () => {
  window.location.replace("/login");
};

const SharedLogin: React.FC<SharedLoginProps> = ({ redirectTo, onReload = reloadLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");

  const { login, isSubmitting } = useCoachAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [diagnosticCopied, setDiagnosticCopied] = useState(false);

  const performReset = async () => {
    setResetting(true);
    try {
      await resetClientState();
    } finally {
      setResetting(false);
      setResetOpen(false);
      onReload();
    }
  };

  const copyDiagnostic = async () => {
    try {
      await navigator.clipboard.writeText(formatAuthTrace());
      setDiagnosticCopied(true);
      setFormError("");
    } catch {
      setFormError("No se pudo copiar el diagnóstico.");
    }
  };

  useEffect(() => {
    traceAuth("login.page_shown", { search: location.search });
    if (new URLSearchParams(location.search).get("reset") === "1") {
      void performReset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
    setFormError("");
    setSuccessMessage("");
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    setFormError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setFormError("Por favor, complete todos los campos.");
      return;
    }

    const result = await login(username, password);

    if (result.success) {
      setSuccessMessage("Inicio de sesión exitoso.");
      setFormError("");
      setUsername("");
      setPassword("");

      const target = redirectTo ?? "/appSelector";

      setTimeout(() => {
        navigate(target, { replace: true });

        setTimeout(() => {
          try {
            if (
              typeof window !== "undefined" &&
              window.location.pathname !== target
            ) {
              window.location.href = target;
            }
          } catch {
            // ignore
          }
        }, 800);
      }, 500);
    } else {
      setFormError(result.error ?? "Ha ocurrido un error al iniciar sesión.");
      setSuccessMessage("");
    }
  };

  useEffect(() => {
    const syncAutofill = () => {
      try {
        const u =
          (usernameRef.current ||
            (document.querySelector(
              'input[name="username"]',
            ) as HTMLInputElement | null)) ??
          null;
        const p =
          (passwordRef.current ||
            (document.querySelector(
              'input[name="password"]',
            ) as HTMLInputElement | null)) ??
          null;

        const uVal = u?.value;
        const pVal = p?.value;

        if (uVal && !username) setUsername(uVal);
        if (pVal && !password) setPassword(pVal);
      } catch {
        // ignore
      }
    };

    syncAutofill();
    const timers: number[] = [];
    timers.push(window.setTimeout(syncAutofill, 50));
    timers.push(window.setTimeout(syncAutofill, 150));
    timers.push(window.setTimeout(syncAutofill, 300));
    timers.push(window.setTimeout(syncAutofill, 800));

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const handleInputFocus = () => {
    try {
      const sync = () => {
        const uVal = usernameRef.current?.value;
        const pVal = passwordRef.current?.value;
        if (uVal && !username) setUsername(uVal);
        if (pVal && !password) setPassword(pVal);
      };
      sync();
      setTimeout(sync, 50);
      setTimeout(sync, 200);
    } catch {
      // ignore
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <Box className={styles.centerWrap}>
        <Paper className={styles.paper} elevation={3}>
          <div className={styles.title}>
            <Typography variant="h4" component="h1">
              Iniciar Sesión
            </Typography>
          </div>

          {formError ? (
            <Alert severity="error" className={styles.alert}>
              {formError}
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert severity="success" className={styles.alert}>
              {successMessage}
            </Alert>
          ) : null}

          <Box
            component="form"
            className={styles.form}
            noValidate
            autoComplete="on"
            onSubmit={handleSubmit}
          >
            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              className={styles.autofillHelper}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              className={styles.autofillHelper}
            />

            <TextField
              id="login-username"
              label="Usuario"
              type="text"
              variant="outlined"
              fullWidth
              required
              autoFocus
              autoComplete="username"
              name="username"
              inputRef={usernameRef}
              value={username}
              onChange={handleUsernameChange}
              onFocus={handleInputFocus}
              inputProps={{
                autoComplete: "username",
                id: "login-username",
                "aria-label": "Usuario",
              }}
            />

            <TextField
              id="login-password"
              label="Contraseña"
              type="password"
              variant="outlined"
              fullWidth
              required
              autoComplete="current-password"
              name="password"
              inputRef={passwordRef}
              value={password}
              onChange={handlePasswordChange}
              onFocus={handleInputFocus}
              inputProps={{
                autoComplete: "current-password",
                id: "login-password",
                "aria-label": "Contraseña",
              }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className={styles.submitButton}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={18} className={styles.spinner} />
                ) : undefined
              }
            >
              {isSubmitting ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </Box>

          <div className={styles.options}>
            <Link component={RouterLink} to="/register" underline="hover">
              Registrarse
            </Link>
            <Link
              component={RouterLink}
              to="/forgot-password"
              underline="hover"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div className={styles.recovery}>
            <Typography variant="caption" color="text.secondary">
              ¿No consigues entrar o vuelves siempre a esta pantalla?
            </Typography>
            <Button size="small" variant="outlined" color="inherit" onClick={() => setResetOpen(true)}>
              Limpiar sesión y datos
            </Button>
            <Button size="small" variant="text" color="inherit" onClick={copyDiagnostic}>
              {diagnosticCopied ? "Diagnóstico copiado" : "Copiar diagnóstico"}
            </Button>
          </div>
        </Paper>
      </Box>

      <ConfirmDialog
        open={resetOpen}
        title="Limpiar sesión y datos"
        description="Se borrarán los datos guardados de la aplicación en este dispositivo (sesión, preferencias y caché). Tendrás que volver a iniciar sesión."
        confirmText="Limpiar"
        processing={resetting}
        onCancel={() => setResetOpen(false)}
        onConfirm={performReset}
      />
    </BaseLayout>
  );
};

export default SharedLogin;
