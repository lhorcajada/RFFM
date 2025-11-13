import React from "react";
import { Paper, Typography } from "@mui/material";
import styles from "./GroupSummaryBox.module.css";

type GroupEntry = {
  competitionName: string;
  teamName: string;
  teamPoints: number;
  count: number;
};

export default function GroupSummaryBox({
  groups,
  title,
}: {
  groups: GroupEntry[];
  title?: string;
}): JSX.Element {
  return (
    <div className={styles.wrap}>
      {title && (
        <Typography variant="subtitle2" style={{ marginBottom: 6 }}>
          {title}
        </Typography>
      )}
      <Paper className={styles.box} elevation={0}>
        {groups.map((g) => (
          <div
            key={`${g.competitionName}-${g.teamName}`}
            className={styles.item}
          >
            <div className={styles.left}>
              <Typography variant="body2">{g.competitionName}</Typography>
              <Typography variant="caption">{g.teamName}</Typography>
            </div>
            <div className={styles.right}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  alignItems: "baseline",
                }}
              >
                <Typography variant="caption">Número de jugadores:</Typography>
                <Typography variant="h6">{g.count}</Typography>
              </div>
              <Typography variant="caption">Puntos: {g.teamPoints}</Typography>
            </div>
          </div>
        ))}
      </Paper>
    </div>
  );
}
