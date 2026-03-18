import React from "react";
import styles from "./Referees.module.css";
import { Paper, Typography, List, ListItem, Avatar } from "@mui/material";
import type { Referee } from "../../../types/acta";
import AvatarWithUrl from "../../../../../shared/components/ui/AvatarWithUrl/AvatarWithUrl";

export default function Referees({ refs }: { refs: Referee[] }) {
  return (
    <Paper className={styles.root} elevation={0}>
      <Typography variant="subtitle1">Árbitros</Typography>
      <List>
        {refs.map((r) => (
          <ListItem key={r.cod_arbitro} className={styles.item}>
            <div className={styles.avatarWrap}>
              <AvatarWithUrl url={(r as any).foto} />
            </div>
            <div className={styles.refInfo}>
              <div className={styles.name}>{r.nombre_arbitro}</div>
              <div className={styles.role}>{r.tipo_arbitro}</div>
            </div>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
