import { Card, CardActionArea, CardContent, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import styles from "../AppSelector.module.css";

interface AppCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  access: string;
  onClick: () => void;
}

export default function AppCard({ icon, title, description, access, onClick }: AppCardProps) {
  return (
    <Card className={styles.card}>
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent className={styles.cardContent}>
          <div className={styles.iconBox}>{icon}</div>
          <div className={styles.cardBody}>
            <Typography variant="h4" component="h2" className={styles.cardTitle}>
              {title}
            </Typography>
            <Typography className={styles.cardDescription}>{description}</Typography>
          </div>
          <div className={styles.cardFooter}>
            <span className={styles.cardAccess}>{access}</span>
            <span className={styles.cardEnter} aria-hidden="true">
              Entrar
              <ArrowForwardIcon fontSize="small" />
            </span>
          </div>
          <ChevronRightIcon className={styles.cardChevron} aria-hidden="true" />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
