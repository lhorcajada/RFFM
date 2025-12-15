import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Link,
  CircularProgress,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import styles from "./Login.module.css";
import { useCoachAuthContext } from "../../../../apps/coach/context/CoachAuthContext";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";

const SharedLogin: React.FC<{ redirectTo?: string }> = ({ redirectTo }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const { login, isSubmitting } = useCoachAuthContext();
  const navigate = useNavigate();

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

    const success = await login(username, password);

    if (success.success) {
      setSuccessMessage("Inicio de sesión exitoso.");
      setUsername("");
      setPassword("");
      setTimeout(() => {
        // Try SPA navigation first
        navigate("/appSelector", { replace: true });

        // Fallback: if for some reason the router doesn't navigate (race or outside router),
        // force a full page redirect after a short timeout.
        setTimeout(() => {
          try {
            if (
              typeof window !== "undefined" &&
              window.location.pathname !== "/appSelector"
            ) {
              window.location.href = "/appSelector";
            }
          } catch (e) {}
        }, 800);
      }, 500);
    } else {
      setFormError(success.error ?? "Ha ocurrido un error al iniciar sesión.");
    }
  };

  // Some browsers autofill credentials after React mounts but do not
  // trigger React's onChange handlers. Read the DOM values shortly after
  // mount (and after a tiny delay) and populate state so handleSubmit
  // uses the actual input values when the user accepts the suggestion.
  useEffect(() => {
    const syncAutofill = () => {
      try {
        const u = (usernameRef.current || document.querySelector('input[name="username"]')) as HTMLInputElement | null;
        const p = (passwordRef.current || document.querySelector('input[name="password"]')) as HTMLInputElement | null;
        const uVal = u?.value;
        const pVal = p?.value;
        if (uVal && !username) setUsername(uVal);
        if (pVal && !password) setPassword(pVal);
      } catch (e) {
        // ignore
      }
    };
    // run immediately and after several short delays to catch different browsers
    syncAutofill();
    const timers: number[] = [];
    timers.push(window.setTimeout(syncAutofill, 50));
    timers.push(window.setTimeout(syncAutofill, 150));
    timers.push(window.setTimeout(syncAutofill, 300));
    timers.push(window.setTimeout(syncAutofill, 800));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  // Refs for inputs to read DOM values directly
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const handleInputFocus = () => {
    try {
      const sync = () => {
        const uVal = usernameRef.current?.value;
        const pVal = passwordRef.current?.value;
        if (uVal && !username) setUsername(uVal);
        if (pVal && !password) setPassword(pVal);
      };
      sync();
      // also schedule a follow-up in case browser applies autofill slightly after focus
      setTimeout(sync, 50);
      setTimeout(sync, 200);
    } catch (e) {}
  };

  return (
    <BaseLayout appTitle="Futbol Base">
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          flex: 1,
          px: 2,
        }}
      >
        <Paper className={styles.paper} elevation={3}>
          <div className={styles.title}>
            <Typography variant="h4" component="h1">
              Iniciar Sesión
            </Typography>
          </div>

          {formError && (
            <Alert severity="error" style={{ marginBottom: "16px" }}>
              {formError}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" style={{ marginBottom: "16px" }}>
              {successMessage}
            </Alert>
          )}

          <Box
            component="form"
            className={styles.form}
            noValidate
            autoComplete="on"
            onSubmit={handleSubmit}
          >
            {/* Hidden native inputs improve browser autofill compatibility
                for controlled React inputs (some browsers won't autofill
                Material UI controlled fields reliably). */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              style={{
                position: "absolute",
                left: -9999,
                top: -9999,
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
              }}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              style={{
                position: "absolute",
                left: -9999,
                top: -9999,
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
              }}
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
                'aria-label': 'Usuario',
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
                'aria-label': 'Contraseña',
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
              sx={{
                bgcolor: isSubmitting ? "#00e5ff" : undefined,
                color: isSubmitting ? "#001f2d" : undefined,
                "&.Mui-disabled": {
                  bgcolor: "#00e5ff",
                  color: "#001f2d",
                },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={18} sx={{ color: "inherit" }} />
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
