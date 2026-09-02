import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { useRffmSeason } from "../../../context/RffmSeasonContext";
import styles from "./RffmSeasonSelector.module.css";

export default function RffmSeasonSelector() {
  const { seasonId, seasons, setSeasonId } = useRffmSeason();

  return (
    <FormControl
      className={styles.container}
      variant="outlined"
      size="small"
    >
      <InputLabel id="rffm-season-select-label">Temporada RFFM</InputLabel>
      <Select
        labelId="rffm-season-select-label"
        label="Temporada RFFM"
        value={seasonId ?? ""}
        onChange={(e) => setSeasonId(Number(e.target.value))}
      >
        {seasons.map((season) => (
          <MenuItem key={season.id} value={season.id}>
            {season.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
