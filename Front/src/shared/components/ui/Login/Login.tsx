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
import { Link as RouterLink, useNavigate } from "react-router-dom";
import styles from "./Login.module.css";
import { useCoachAuthContext } from "../../../../apps/coach/context/CoachAuthContext";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";

type SharedLoginProps = {
  redirectTo?: string;
};

const SharedLogin: React.FC<SharedLoginProps> = ({ redirectTo }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");

  const { login, isSubmitting } = useCoachAuthContext();
  const navigate = useNavigate();

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
    <BaseLayout appTitle="Futbol Base" hideFooterMenu>
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
        </Paper>
      </Box>
    </BaseLayout>
  );
};

export default SharedLogin;
