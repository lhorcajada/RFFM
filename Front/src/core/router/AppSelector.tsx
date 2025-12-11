import React from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Card, CardActionArea, CardContent } from "@mui/material";
import SportsIcon from "@mui/icons-material/Sports";
import GroupsIcon from "@mui/icons-material/Groups";
import styles from "./AppSelector.module.css";
import { coachAuthService } from "../../apps/coach/services/authService";

function dispatchSnackbar(message: string) {
  try {
    window.dispatchEvent(
      new CustomEvent("rffm.show_snackbar", {
        detail: { message, severity: "warning" },
      })
    );
  } catch (e) {}
}

export default function AppSelector() {
  const navigate = useNavigate();

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Typography variant="h3" component="h1" className={styles.title}>
            RFFM Platform
          </Typography>
          <Typography variant="h6" className={styles.subtitle}>
            Selecciona tu aplicación
          </Typography>
        </div>

        <div className={styles.gridContainer}>
          <Card className={styles.card}>
            <CardActionArea
              onClick={() => {
                // Federation requires Federation role (Administrator bypasses)
                if (!coachAuthService.isAuthenticated()) {
                  navigate("/login");
                  return;
                }
                if (
                  coachAuthService.hasRole("Administrator") ||
                  coachAuthService.hasRole("Federation")
                ) {
                  navigate("/federation/dashboard");
                } else {
                  dispatchSnackbar(
                    "No tienes permisos para acceder a Federación."
                  );
                }
              }}
              sx={{ height: "100%" }}
            >
              <CardContent className={styles.cardContent}>
                <GroupsIcon className={styles.icon} />
                <Typography
                  variant="h4"
                  component="h2"
                  className={styles.cardTitle}
                >
                  Federación
                </Typography>
                <Typography className={styles.cardDescription}>
                  Gestión de competiciones, equipos, clasificaciones y
                  estadísticas de la Federación de Fútbol de Madrid
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>

          <Card className={styles.card}>
            <CardActionArea
              onClick={() => {
                // Coach requires Coach role (Administrator bypasses)
                if (!coachAuthService.isAuthenticated()) {
                  navigate("/login");
                  return;
                }
                if (
                  coachAuthService.hasRole("Administrator") ||
                  coachAuthService.hasRole("Coach")
                ) {
                  navigate("/coach/dashboard");
                } else {
                  dispatchSnackbar(
                    "No tienes permisos para acceder a la sección de Entrenadores."
                  );
                }
              }}
              sx={{ height: "100%" }}
            >
              <CardContent className={styles.cardContent}>
                <SportsIcon className={styles.icon} />
                <Typography
                  variant="h4"
                  component="h2"
                  className={styles.cardTitle}
                >
                  Entrenadores
                </Typography>
                <Typography className={styles.cardDescription}>
                  Herramientas para entrenadores: gestión de plantillas,
                  entrenamientos, planificación y análisis de rendimiento
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </div>
      </div>
    </div>
  );
}
