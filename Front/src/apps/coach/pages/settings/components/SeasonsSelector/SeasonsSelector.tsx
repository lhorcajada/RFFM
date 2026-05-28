import React, { useEffect, useState } from "react";
import { Button, Chip, Typography } from "@mui/material";
import seasonService, { type Season } from "../../../../services/seasonService";
import SeasonManagementDialog from "../SeasonManagementDialog";
import styles from "./SeasonsSelector.module.css";

interface SeasonsSelectorProps {
  clubId?: string | null;
}

const SeasonsSelector: React.FC<SeasonsSelectorProps> = ({ clubId }) => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!clubId) {
        setSeasons([]);
        return;
      }
      const seasonsResp = await seasonService.getSeasons(clubId);
      setSeasons(seasonsResp);
    };
    load();
  }, [clubId]);

  const activeSeason = seasons.find((s) => s.active ?? s.isActive) ?? null;

  const formatSeasonDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 10);
    return date.toLocaleDateString("es-ES");
  };

  return (
    <div className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <span className={styles.panelHeaderDot} />
        <span className={styles.panelHeaderTitle}>Temporadas</span>
      </div>

      <div className={styles.seasonSummary}>
        <div className={styles.seasonMeta}>
          <Typography variant="subtitle2" className={styles.sectionTitle}>
            Temporada activa
          </Typography>
          {activeSeason ? (
            <>
              <Typography variant="body2" className={styles.seasonName}>
                {activeSeason.name ?? activeSeason.id}
              </Typography>
              <Typography variant="body2" className={styles.seasonRange}>
                {formatSeasonDate(activeSeason.startDate)} - {formatSeasonDate(activeSeason.endDate)}
              </Typography>
            </>
          ) : (
            <div className={styles.emptyNotice}>
              No hay temporada activa. Entra al formulario para crear o activar una temporada.
            </div>
          )}
        </div>

        <div className={styles.sectionActions}>
          <Chip
            label={seasons.length > 0 ? `${seasons.length} temporadas` : "Sin temporadas"}
            size="small"
            variant="outlined"
          />
          <Button variant="contained" size="small" onClick={() => setManagerOpen(true)}>
            Administrar temporadas
          </Button>
        </div>
      </div>

      <SeasonManagementDialog
        clubId={clubId ?? ""}
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onChanged={async () => {
          if (!clubId) return;
          const latestSeasons = await seasonService.getSeasons(clubId);
          setSeasons(latestSeasons);
        }}
      />
    </div>
  );
};

export default SeasonsSelector;
