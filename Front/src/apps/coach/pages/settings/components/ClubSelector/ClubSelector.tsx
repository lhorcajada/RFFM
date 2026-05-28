import React, { useEffect, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import clubService from "../../../../services/clubService";
import styles from "./ClubSelector.module.css";

interface ClubSelectorProps {
  initialValue?: string | null;
  onChange: (clubId: string | null) => void;
}

const ClubSelector: React.FC<ClubSelectorProps> = ({ initialValue, onChange }) => {
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState<string | null>(initialValue ?? null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const clubsResp = await clubService.getUserClubs();
        setClubs(
          clubsResp.map((c) => ({
            id: c.clubId,
            name: c.clubName,
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setValue(initialValue ?? null);
  }, [initialValue]);

  const handleChange = (val: string) => {
    const v = val === "" ? null : val;
    setValue(v);
    onChange(v);
  };

  return (
    <div className={styles.settingRow}>
      <div className={styles.settingLabel}>Club preferido</div>
      <div className={styles.settingControl}>
        {clubs.length === 0 && !loading ? (
          <div className={styles.emptyNotice}>
            Sin clubes. No hay clubes disponibles para configurar.
          </div>
        ) : (
          <FormControl fullWidth size="small">
            <InputLabel id="club-label">Club</InputLabel>
            <Select
              labelId="club-label"
              value={value ?? ""}
              label="Club"
              onChange={(e) => handleChange(e.target.value as string)}
            >
              <MenuItem value="">-- Ninguno --</MenuItem>
              {clubs.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </div>
    </div>
  );
};

export default ClubSelector;
