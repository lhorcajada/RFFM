import React, { ReactNode } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";

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
    <Card style={{ width: 260 }}>
      <CardContent>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: "#f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </div>
        </div>
        <Typography gutterBottom variant="h6" component="div">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" component={Link} to={to}>
          Abrir
        </Button>
      </CardActions>
    </Card>
  );
}
