import React from "react";
import styles from "./Substitutions.module.css";
import { Paper, Typography, List, ListItem } from "@mui/material";

export default function Substitutions({
  local,
  away,
}: {
  local: any[];
  away: any[];
}) {
  const localList = Array.isArray(local) ? local : [];
  const awayList = Array.isArray(away) ? away : [];

  if (localList.length === 0 && awayList.length === 0) return null;

  return (
    <Paper className={styles.root} elevation={0}>
      <Typography variant="subtitle1">Sustituciones</Typography>
      <div className={styles.colRow}>
        <div>
          <Typography variant="subtitle2">Local</Typography>
          <List>
            {localList.map((s, idx) => (
              <ListItem key={idx}>
                {s.minuto ? `${s.minuto}'` : ""} — {s.titular || ""} →{" "}
                {s.suplente || ""}
              </ListItem>
            ))}
          </List>
        </div>
        <div>
          <Typography variant="subtitle2">Visitante</Typography>
          <List>
            {awayList.map((s, idx) => (
              <ListItem key={idx}>
                {s.minuto ? `${s.minuto}'` : ""} — {s.titular || ""} →{" "}
                {s.suplente || ""}
              </ListItem>
            ))}
          </List>
        </div>
      </div>
    </Paper>
  );
}
