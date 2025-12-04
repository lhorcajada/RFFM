import React, { ReactNode } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import styles from "./DashboardCard.module.css";

export default function DashboardCard({
  title,
  description,
  icon,
  to,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
}) {
  return (
    <Card className={styles.card}>
      <CardContent>
        <div className={styles.iconWrap}>{icon}</div>
        <Typography
          gutterBottom
          variant="h6"
          component="div"
          className={styles.title}
        >
          {title}
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small" component={Link} to={to} className={styles.button}>
          Abrir
        </Button>
      </CardActions>
    </Card>
  );
}
