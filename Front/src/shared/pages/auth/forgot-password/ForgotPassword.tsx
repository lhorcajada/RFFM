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
import styles from "./ForgotPassword.module.css";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import { mapApiErrorToMessage } from "../../../../apps/coach/utils/errorMessages";
import { Link as RouterLink } from "react-router-dom";
import BaseLayout from "../../../components/ui/BaseLayout/BaseLayout";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    setFormError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setFormError("Por favor, ingresa tu correo electrónico.");
      return;
    }

    setIsSubmitting(true);
    try {
      await coachAuthService.requestPasswordReset(email);
      setSuccessMessage(
        "Se ha enviado un enlace de reseteo a tu correo electrónico."
      );
      setEmail("");
    } catch (error: any) {
      const errorMessage = mapApiErrorToMessage(error);
      setFormError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseLayout appTitle="Futbol Base">
      <div className={styles.container}>
        <Paper className={styles.paper} elevation={3}>
          <div className={styles.title}>
            <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
              Recuperar Contraseña
            </Typography>
          </div>
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
          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            <TextField
              label="Correo Electrónico"
              type="email"
              variant="outlined"
              fullWidth
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={handleEmailChange}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className={styles.submitButton}
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? <CircularProgress size={18} /> : undefined
              }
            >
              {isSubmitting ? "Enviando..." : "Enviar Enlace de Reseteo"}
            </Button>
          </form>
          <div className={styles.options}>
            <Link component={RouterLink} to="/login" underline="hover">
              Volver a iniciar sesión
            </Link>
          </div>
        </Paper>
      </div>
    </BaseLayout>
  );
};

export default ForgotPassword;
