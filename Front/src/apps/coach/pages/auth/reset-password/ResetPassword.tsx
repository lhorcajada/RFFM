import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Link,
  Container,
} from "@mui/material";
import styles from "../login/Login.module.css";
import { useSearchParams, useNavigate } from "react-router-dom";
import { coachAuthService } from "../../../services/authService";
import { mapApiErrorToMessage } from "../../../utils/errorMessages";
import BaseLayout from "../../../components/ui/BaseLayout/BaseLayout";

const CoachResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  if (!token) {
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
            <Alert severity="error">Token de reseteo no válido.</Alert>
            <Link href="/coach/login" underline="hover">
              Volver a iniciar sesión
            </Link>
          </Paper>
        </Box>
      </BaseLayout>
    );
  }

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    setFormError("");
    setSuccessMessage("");
  };

  const handleConfirmPasswordChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfirmPassword(event.target.value);
    setFormError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password.trim() || !confirmPassword.trim()) {
      setFormError("Por favor, completa todos los campos.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      await coachAuthService.resetPassword(token, password);
      setSuccessMessage("Contraseña reestablecida exitosamente.");
      setTimeout(() => {
        navigate("/coach/login");
      }, 2000);
    } catch (error: any) {
      const errorMessage = mapApiErrorToMessage(error);
      setFormError(errorMessage);
    } finally {
      setIsSubmitting(false);
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
          <Box className={styles.title}>
            <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
              Reestablecr Contraseña
            </Typography>
          </Box>
          {formError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {formError}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {successMessage}
            </Alert>
          )}{" "}
          <Box
            component="form"
            className={styles.form}
            noValidate
            onSubmit={handleSubmit}
          >
            <TextField
              label="Nueva Contraseña"
              type="password"
              variant="outlined"
              fullWidth
              required
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={handlePasswordChange}
            />
            <TextField
              label="Confirmar Contraseña"
              type="password"
              variant="outlined"
              fullWidth
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Reestableciendo..." : "Reestablecr Contraseña"}
            </Button>
          </Box>
          <Box className={styles.options} sx={{ mt: 2, textAlign: "center" }}>
            <Link href="/coach/login" underline="hover">
              Volver a iniciar sesión
            </Link>
          </Box>
        </Paper>
      </Box>
    </BaseLayout>
  );
};

export default CoachResetPassword;
