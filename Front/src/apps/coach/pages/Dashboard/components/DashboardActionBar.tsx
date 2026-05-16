import { Button, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import styles from "../Dashboard.module.css";

interface DashboardActionBarProps {
  isPlayer?: boolean;
}

export default function DashboardActionBar({
  isPlayer = false,
}: DashboardActionBarProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.actionBarContent}>
      <Button
        variant="outlined"
        startIcon={<HomeIcon />}
        onClick={() => navigate("/")}
        sx={{ textTransform: "none", marginLeft: "auto" }}
      >
        Volver al inicio
      </Button>
    </div>
  );
}
