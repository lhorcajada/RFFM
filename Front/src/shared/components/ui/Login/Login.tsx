import React, { useState } from "react";
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
            onSubmit={handleSubmit}
          >
            <TextField
              label="Usuario"
              type="text"
              variant="outlined"
              fullWidth
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={handleUsernameChange}
            />
            <TextField
              label="Contraseña"
              type="password"
              variant="outlined"
              fullWidth
              required
              autoComplete="current-password"
              value={password}
              onChange={handlePasswordChange}
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
