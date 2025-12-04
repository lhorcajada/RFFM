import React from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Card, CardActionArea, CardContent } from "@mui/material";
import SportsIcon from "@mui/icons-material/Sports";
import GroupsIcon from "@mui/icons-material/Groups";
import styles from "./AppSelector.module.css";

export default function AppSelector() {
  const navigate = useNavigate();

  return (
    <div className={styles.wrapper}>
      <div style={{ maxWidth: "1000px", width: "100%" }}>
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
              onClick={() => navigate("/federation/dashboard")}
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
              onClick={() => navigate("/coach/dashboard")}
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
