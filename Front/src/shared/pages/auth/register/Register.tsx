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
import styles from "./Register.module.css";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import useTempToken from "../../../../apps/coach/hooks/useTempToken";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { mapApiErrorToMessage } from "../../../../apps/coach/utils/errorMessages";
import BaseLayout from "../../../components/ui/BaseLayout/BaseLayout";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { generateTempToken } = useTempToken();

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    setFormError("");
    setSuccessMessage("");
  };

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

    if (!email.trim() || !username.trim() || !password.trim()) {
      setFormError("Por favor, complete todos los campos.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        username: username,
        password: password,
        email: email,
      };
      const token = await generateTempToken(payload);
      await coachAuthService.register(token);
      setSuccessMessage("Registro exitoso. Ahora puedes iniciar sesión.");
      setEmail("");
      setUsername("");
      setPassword("");
      setTimeout(() => {
        navigate("/login");
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
      <div className={styles.container}>
        <Paper className={styles.paper} elevation={3}>
          <div className={styles.title}>
            <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
              Registrarse
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
            <TextField
              label="Nombre de Usuario"
              type="text"
              variant="outlined"
              fullWidth
              required
              autoComplete="username"
              value={username}
              onChange={handleUsernameChange}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Contraseña"
              type="password"
              variant="outlined"
              fullWidth
              required
              autoComplete="new-password"
              value={password}
              onChange={handlePasswordChange}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Registrando..." : "Registrarse"}
            </Button>
          </form>
          <div className={styles.options}>
            <Link component={RouterLink} to="/login" underline="hover">
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
        </Paper>
      </div>
    </BaseLayout>
  );
};

export default Register;
