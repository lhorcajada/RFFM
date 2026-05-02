import { Button, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import SeasonSelector from "../../../../../shared/components/ui/SeasonSelector/SeasonSelector";
import styles from "../Dashboard.module.css";

interface DashboardActionBarProps {
  selectedSeason: string;
  onSeasonChange: (v: string | null) => void;
  hasPreferredSelection: boolean;
  loadingConfig: boolean;
  onLoadPreferred: () => void;
}

export default function DashboardActionBar({
  selectedSeason,
  onSeasonChange,
  hasPreferredSelection,
  loadingConfig,
  onLoadPreferred,
}: DashboardActionBarProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.actionBarContent}>
      <div className={styles.seasonSelectorWrap}>
        <SeasonSelector
          value={selectedSeason}
          onChange={onSeasonChange}
          size="small"
          showLabel={false}
        />
      </div>
      {!hasPreferredSelection && (
        <Button
          variant="outlined"
          startIcon={<SportsFootballIcon />}
          onClick={onLoadPreferred}
          sx={{ textTransform: "none" }}
        >
          {loadingConfig ? <CircularProgress size={20} /> : "Cargar equipo preferente"}
        </Button>
      )}
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
