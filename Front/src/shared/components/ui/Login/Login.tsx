import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Link,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import { useNavigate } from "react-router-dom";
import styles from "./Login.module.css";
import { useCoachAuthContext } from "../../../../apps/coach/context/CoachAuthContext";
import BaseLayout from "../../../../apps/coach/components/ui/BaseLayout/BaseLayout";

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
        navigate(redirectTo || "/");
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
            >
              {isSubmitting ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </Box>

          <div className={styles.options}>
            <Link href="/coach/register" underline="hover">
              Registrarse
            </Link>
            <Link href="/coach/forgot-password" underline="hover">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => navigate("/")}
            >
              Volver al inicio
            </Button>
          </div>
        </Paper>
      </Box>
    </BaseLayout>
  );
};

export default SharedLogin;
