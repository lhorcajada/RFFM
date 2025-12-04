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
import { coachAuthService } from "../../../services/authService";
import { mapApiErrorToMessage } from "../../../utils/errorMessages";
import BaseLayout from "../../../components/ui/BaseLayout/BaseLayout";

const CoachForgotPassword: React.FC = () => {
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
              Recuperar Contraseña
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
            >
              {isSubmitting ? "Enviando..." : "Enviar Enlace de Reseteo"}
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

export default CoachForgotPassword;
