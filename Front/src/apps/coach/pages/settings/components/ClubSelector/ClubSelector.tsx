import React, { useEffect, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select, Button, Chip, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import clubService from "../../../../services/clubService";
import styles from "./ClubSelector.module.css";

interface ClubSelectorProps {
  initialValue?: string | null;
  onChange: (clubId: string | null) => void;
}

const ClubSelector: React.FC<ClubSelectorProps> = ({ initialValue, onChange }) => {
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerOpen, setManagerOpen] = useState(false);
  const [value, setValue] = useState<string | null>(initialValue ?? null);
  const navigate = useNavigate();

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

        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Chip label={clubs.length > 0 ? `${clubs.length} clubes` : "Sin clubes"} size="small" variant="outlined" />
          <Button size="small" variant="contained" onClick={() => setManagerOpen((s) => !s)}>
            {managerOpen ? 'Ocultar' : 'Administrar clubes'}
          </Button>
        </div>

        {managerOpen && (
          <div style={{ marginTop: 12 }}>
            <Typography variant="subtitle2" style={{ marginBottom: 8 }}>
              Mis clubes
            </Typography>
            <div className={styles.listWrap}>
              {loading ? (
                <div style={{ padding: 12 }}>Cargando...</div>
              ) : clubs.length === 0 ? (
                <div style={{ padding: 12 }}>
                  No tienes clubes. Puedes crear uno en la página de clubes.
                </div>
              ) : (
                <div style={{ padding: 8 }}>
                  {clubs.map((c) => (
                    <div key={c.id} style={{ padding: 6 }}>{c.name}</div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => navigate('/coach/clubs')}>Ir a clubs</Button>
              <Button size="small" variant="contained" onClick={() => navigate('/coach/clubs/new')} style={{ marginLeft: 8 }}>Crear club</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubSelector;
