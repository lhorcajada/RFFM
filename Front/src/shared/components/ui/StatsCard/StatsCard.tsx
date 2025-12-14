import React from "react";
import styles from "./StatsCard.module.css";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import BarChartIcon from "@mui/icons-material/BarChart";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export default function StatsCard(): JSX.Element {
  const navigate = useNavigate();
  const theme = useTheme();

  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Card className={styles.card}>
      <CardContent>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className={styles.iconWrap}>
            <SportsSoccerIcon fontSize="small" sx={{ color: "#1976d2" }} />
            <BarChartIcon fontSize="small" sx={{ color: "#1976d2" }} />
          </div>
          <Typography gutterBottom variant="h6" component="div">
            Comparativa: Sectores de goles
          </Typography>
        </div>
      </CardContent>
      <CardActions>
        <Button
          size="small"
          className={styles.button}
          onClick={() => navigate("/federation/goal-sectors-comparison")}
        >
          Abrir
        </Button>
      </CardActions>
    </Card>
  );
}
