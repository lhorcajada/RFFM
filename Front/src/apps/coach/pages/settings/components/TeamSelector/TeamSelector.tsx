import React, { useEffect, useState } from "react";
import { Button, Chip, Typography, Avatar, Box } from "@mui/material";
import teamService, { TeamResponse } from "../../../../services/teamService";
import seasonStyles from "../SeasonsSelector/SeasonsSelector.module.css";
import TeamManagementDialog from "./TeamManagementDialog";

interface TeamSelectorProps {
  clubId?: string | null;
  initialValue?: string | null;
  onChange: (teamId: string | null) => void;
}

const TeamSelector: React.FC<TeamSelectorProps> = ({ clubId, initialValue, onChange }) => {
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState<string | null>(initialValue ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preferredTeam, setPreferredTeam] = useState<TeamResponse | null>(null);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialValue ?? null);
  }, [initialValue]);

  useEffect(() => {
    const load = async () => {
      if (!clubId) {
        setTeams([]);
        setValue(null);
        onChange(null);
        setPreferredTeam(null);
        setPhotoSrc(null);
        return;
      }
      setLoading(true);
      try {
        const teamsResp = await teamService.getTeams(clubId);
        setTeams(teamsResp);
      } finally {
        setLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    // when the selected team id changes, load its full data
    const loadPreferred = async () => {
      if (!value) {
        setPreferredTeam(null);
        setPhotoSrc(null);
        return;
      }
      try {
        const full = await teamService.getTeamById(value);
        setPreferredTeam(full);
        if (full?.urlPhoto) {
          const obj = await teamService.fetchTeamPhoto(full.urlPhoto);
          setPhotoSrc(obj ?? null);
        } else {
          setPhotoSrc(null);
        }
      } catch (e) {
        setPreferredTeam(null);
        setPhotoSrc(null);
      }
    };
    void loadPreferred();
  }, [value]);

  // preferred team id is provided via `initialValue` and persisted by Settings

  return (
    <div className={seasonStyles.sectionBlock}>
      <div className={seasonStyles.sectionHeader}>
        <span className={seasonStyles.panelHeaderDot} />
        <span className={seasonStyles.panelHeaderTitle}>Equipo preferido</span>
      </div>

      <div className={seasonStyles.seasonSummary}>
        <div className={seasonStyles.seasonMeta}>
          <Typography variant="subtitle2" className={seasonStyles.sectionTitle}>
            Equipo preferido
          </Typography>

          {preferredTeam ? (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Avatar src={photoSrc ?? undefined} alt={preferredTeam.name} sx={{ width: 48, height: 48 }} />
                <Typography variant="body2" className={seasonStyles.seasonName}>
                  {preferredTeam.name}
                </Typography>
              </Box>

              <Typography variant="body2" className={seasonStyles.seasonRange}>
                {preferredTeam.category?.name ?? "-"}
              </Typography>

              <Typography variant="body2" className={seasonStyles.seasonRange}>
                {preferredTeam.league?.name ? `${preferredTeam.league.name}${preferredTeam.league.group ? ` (Grupo ${preferredTeam.league.group})` : ""}` : "-"}
              </Typography>

              <Typography variant="body2" className={seasonStyles.seasonRange}>
                {/* TeamResponse currently doesn't include season info explicitly; show '-' when unknown */}
                {"-"}
              </Typography>
            </>
          ) : (
            <div className={seasonStyles.emptyNotice}>
              No hay equipo preferido seleccionado. Selecciona o crea un equipo para persistirlo.
            </div>
          )}

          {/* No selection control: preferred team is associated to the season/configuration */}
        </div>

        <div className={seasonStyles.sectionActions}>
          <Chip label={teams.length > 0 ? `${teams.length} equipos` : "Sin equipos"} size="small" variant="outlined" />
          <Button variant="contained" size="small" onClick={() => setDialogOpen(true)} disabled={!clubId}>
            Administrar equipos
          </Button>
        </div>
      </div>

      <TeamManagementDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          void (async () => {
            if (!clubId) return;
            const latest = await teamService.getTeams(clubId);
            setTeams(latest);
          })();
        }}
        clubId={clubId ?? ""}
        onChanged={async () => {
          if (!clubId) return;
          const latest = await teamService.getTeams(clubId);
          setTeams(latest);
        }}
      />
    </div>
  );
};

export default TeamSelector;
