import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
import styles from "../AppSelector.module.css";

interface AppCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

export default function AppCard({ icon, title, description, onClick }: AppCardProps) {
  return (
    <Card className={styles.card}>
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent className={styles.cardContent}>
          {icon}
          <Typography variant="h4" component="h2" className={styles.cardTitle}>
            {title}
          </Typography>
          <Typography className={styles.cardDescription}>{description}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
