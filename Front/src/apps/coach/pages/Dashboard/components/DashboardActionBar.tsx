import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import styles from "./DashboardActionBar.module.css";

interface DashboardActionBarProps {
  isPlayer?: boolean;
}

export default function DashboardActionBar({
  isPlayer = false,
}: DashboardActionBarProps) {
  const navigate = useNavigate();

  if (isPlayer) return null;

  return (
    <div className={styles.actionBarContent}>
      <Button
        variant="outlined"
        startIcon={<HomeOutlinedIcon />}
        onClick={() => navigate("/")}
        className={styles.homeButton}
      >
        Volver al inicio
      </Button>
    </div>
  );
}
