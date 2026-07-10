import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Link,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import styles from "./Register.module.css";
import { coachAuthService } from "../../../../apps/coach/services/authService";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { mapApiErrorToMessage } from "../../../../apps/coach/utils/errorMessages";
import BaseLayout from "../../../components/ui/BaseLayout/BaseLayout";
import type {
  RegisterPayingAccountPayload,
  RegisterPayingAccountResponse,
} from "../../../../shared/types/scope";

const Register: React.FC = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"Coach" | "Directive">("Coach");
  const [successMessage, setSuccessMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

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
      const payload: RegisterPayingAccountPayload = {
        alias: username,
        email: email,
        password: password,
        accountType,
      };
      const result: RegisterPayingAccountResponse =
        await coachAuthService.registerPayingAccount(payload);
      if (Array.isArray(result.roles) && result.roles.length > 0) {
        try {
          localStorage.setItem("coach_roles", JSON.stringify(result.roles));
        } catch {}
      }
      setSuccessMessage("Registro exitoso. Ahora puedes iniciar sesión.");
      setEmail("");
      setUsername("");
      setPassword("");
      setAccountType("Coach");
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
    <BaseLayout appTitle="Futbol Base" hideFooterMenu>
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
            <FormControl component="fieldset" className={styles.accountTypeField}>
              <FormLabel component="legend">Tipo de cuenta</FormLabel>
              <RadioGroup
                row
                name="accountType"
                value={accountType}
                onChange={(e) =>
                  setAccountType(e.target.value as "Coach" | "Directive")
                }
              >
                <FormControlLabel
                  value="Coach"
                  control={<Radio />}
                  label="Entrenador"
                />
                <FormControlLabel
                  value="Directive"
                  control={<Radio />}
                  label="Directivo"
                />
              </RadioGroup>
            </FormControl>
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
