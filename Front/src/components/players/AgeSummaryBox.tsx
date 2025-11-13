import React from "react";
import { Paper, Typography } from "@mui/material";
import styles from "./AgeSummaryBox.module.css";

type Props = {
  playersCountByAge: Record<number, number>;
  ages?: number[];
};

export default function AgeSummaryBox({
  playersCountByAge,
  ages,
  title,
}: Props & { title?: string }): JSX.Element {
  const derivedAges = React.useMemo(() => {
    if (ages && ages.length > 0) return ages;
    const keys = Object.keys(playersCountByAge || {}).map((k) => Number(k));
    keys.sort((a, b) => a - b);
    return keys;
  }, [playersCountByAge, ages]);
  return (
    <div className={styles.wrap}>
      {title && (
        <Typography variant="subtitle2" style={{ marginBottom: 6 }}>
          {title}
        </Typography>
      )}
      <Paper className={styles.box} elevation={0}>
        {derivedAges.map((a) => (
          <div key={a} className={styles.item}>
            <Typography variant="caption">{a} años</Typography>
            <Typography variant="h6">{playersCountByAge[a] ?? 0}</Typography>
          </div>
        ))}
      </Paper>
    </div>
  );
}
