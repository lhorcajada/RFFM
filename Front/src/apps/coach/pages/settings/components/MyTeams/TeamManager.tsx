import React, { useEffect, useState } from "react";
import {
  CircularProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import teamService, { TeamResponse } from "../../../../services/teamService";
import styles from "./TeamManager.module.css";
import seasonService from "../../../../services/seasonService";
import clubService from "../../../../services/clubService";
import type { Season } from "../../../../services/seasonService";

interface TeamManagementDialogProps {
  open?: boolean;
  onClose?: () => void;
  onChanged?: () => void;
  clubId: string;
  inline?: boolean;
}

export default function TeamManager({ open, onChanged, clubId }: TeamManagementDialogProps) {
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasonPreferredTeamId, setSeasonPreferredTeamId] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [preferredClubName, setPreferredClubName] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) {
      setTeams([]);
      setActiveSeason(null);
      setSeasonPreferredTeamId(null);
      setPreferredClubName(null);
      setError("Selecciona un club para administrar los equipos.");
      return;
    }
    void loadActiveSeasonTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clubId]);

  const loadActiveSeasonTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      let preferredClubNameFromApi: string | null = null;
      try {
        const preferredClub = await clubService.getClubById(clubId);
        preferredClubNameFromApi = preferredClub?.name ?? null;
      } catch {
        // Ignore club detail errors and keep loading teams by selected club.
      }
      setPreferredClubName(preferredClubNameFromApi);

      const seasons = await seasonService.getSeasons(clubId);
      const currentActiveSeason = seasons.find((season) => season.active ?? season.isActive) ?? null;
      setActiveSeason(currentActiveSeason);

      if (!currentActiveSeason?.id) {
        setTeams([]);
        setSeasonPreferredTeamId(null);
        setError("No hay una temporada activa para este club.");
        return;
      }

      const all = await teamService.getTeams(clubId, currentActiveSeason.id as any);
      setTeams(all || []);

      if (!preferredClubNameFromApi && all.length > 0) {
        setPreferredClubName(all[0]?.club?.name ?? null);
      }

      setSeasonPreferredTeamId(currentActiveSeason.preferredTeamId ?? null);

      if (!currentActiveSeason.preferredTeamId) {
        const fullSeason = await seasonService.getSeason(currentActiveSeason.id);
        setSeasonPreferredTeamId(fullSeason?.preferredTeamId ?? null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? "Error cargando equipos"));
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreferred = async (team: TeamResponse, checked: boolean) => {
    if (!activeSeason?.id) {
      setError("No hay una temporada activa disponible");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await teamService.setSeasonPreferredTeam(activeSeason.id, checked ? team.id : null);
      setSeasonPreferredTeamId(checked ? team.id : null);
      onChanged?.();
    } catch (e: any) {
      setError(String(e?.message ?? "Error marcando equipo preferido"));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className={styles.dialogContent}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" className={styles.helperText}>
          Se muestran los equipos de la temporada activa. Solo puedes actualizar el equipo preferido.
        </Typography>

        <Typography variant="body2" className={styles.helperText}>
          Temporada activa: {activeSeason?.name ?? "Sin temporada activa"}
        </Typography>

        <Typography variant="body2" className={styles.helperText}>
          Club preferido: {preferredClubName ?? "Sin club preferido"}
        </Typography>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={`${styles.layout} ${styles.layoutSingle}`}>
          <div className={styles.panel}>
            <div className={styles.listHeader}>
              <Typography variant="subtitle1" fontWeight={700}>
                Todos los equipos
              </Typography>
            </div>

            <div className={styles.listWrap}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : teams.length === 0 ? (
                <div className={styles.emptyState}>No hay equipos creados para esta temporada.</div>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Categoría</TableCell>
                      <TableCell>Liga</TableCell>
                      <TableCell>Grupo</TableCell>
                      <TableCell>Preferido</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.id} hover>
                        <TableCell>{team.name}</TableCell>
                        <TableCell>{team.category?.name}</TableCell>
                        <TableCell>{team.league?.name ?? "-"}</TableCell>
                        <TableCell>{team.league?.group ?? "-"}</TableCell>
                        <TableCell>
                          <Switch
                            checked={team.id === seasonPreferredTeamId}
                            onChange={(e) => handleTogglePreferred(team, e.target.checked)}
                            disabled={saving || !activeSeason?.id}
                            size="small"
                            inputProps={{ 'aria-label': 'Marcar preferido' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </Stack>
    </div>
  );


  return (
    <>
      {content}
    </>
  );


}
