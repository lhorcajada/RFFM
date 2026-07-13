import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
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
import type { UserClubsResponse } from "../../../../types/userClubs";

interface TeamManagementDialogProps {
  open?: boolean;
  onClose?: () => void;
  onChanged?: () => void;
  clubId: string;
  inline?: boolean;
}

export default function TeamManager({ open, clubId }: TeamManagementDialogProps) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [preferredClubName, setPreferredClubName] = useState<string | null>(null);

  const [clubPickerOpen, setClubPickerOpen] = useState(false);
  const [availableClubs, setAvailableClubs] = useState<UserClubsResponse[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [selectedClubForCreation, setSelectedClubForCreation] = useState("");

  useEffect(() => {
    if (!clubId) {
      setTeams([]);
      setActiveSeason(null);
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
        setError("No hay una temporada activa para este club.");
        return;
      }

      const all = await teamService.getTeams(clubId, currentActiveSeason.id as any);
      setTeams(all || []);

      if (!preferredClubNameFromApi && all.length > 0) {
        setPreferredClubName(all[0]?.club?.name ?? null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? "Error cargando equipos"));
    } finally {
      setLoading(false);
    }
  };

  const goToCreateTeam = (targetClubId: string) => {
    navigate(`/coach/clubs/${targetClubId}/teams/new`, { state: { from: "settings" } });
  };

  const handleCreateTeamClick = () => {
    if (clubId) {
      goToCreateTeam(clubId);
      return;
    }
    setSelectedClubForCreation("");
    setClubPickerOpen(true);
    setClubsLoading(true);
    clubService
      .getUserClubs()
      .then((clubs) => setAvailableClubs(clubs || []))
      .catch(() => setAvailableClubs([]))
      .finally(() => setClubsLoading(false));
  };

  const handleConfirmClubSelection = () => {
    if (!selectedClubForCreation) return;
    setClubPickerOpen(false);
    goToCreateTeam(selectedClubForCreation);
  };

  const content = (
    <div className={styles.dialogContent}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" className={styles.helperText}>
          Se muestran los equipos de la temporada activa del club seleccionado.
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
              <Button variant="contained" size="small" onClick={handleCreateTeamClick}>
                Crear equipo
              </Button>
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
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.id} hover>
                        <TableCell>{team.name}</TableCell>
                        <TableCell>{team.category?.name}</TableCell>
                        <TableCell>{team.league?.name ?? "-"}</TableCell>
                        <TableCell>{team.league?.group ?? "-"}</TableCell>
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

      <Dialog
        open={clubPickerOpen}
        onClose={() => setClubPickerOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Selecciona un club</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" className={styles.helperText}>
              Elige el club al que quieres asociar el nuevo equipo.
            </Typography>

            {clubsLoading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 80 }}>
                <CircularProgress size={24} />
              </Stack>
            ) : availableClubs.length === 0 ? (
              <div className={styles.emptyState}>No tienes clubes disponibles.</div>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="team-manager-club-picker-label">Club</InputLabel>
                <Select
                  labelId="team-manager-club-picker-label"
                  label="Club"
                  value={selectedClubForCreation}
                  onChange={(e) => setSelectedClubForCreation(String(e.target.value))}
                >
                  {availableClubs.map((club) => (
                    <MenuItem key={club.clubId} value={club.clubId}>
                      {club.clubName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClubPickerOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirmClubSelection}
            variant="contained"
            disabled={!selectedClubForCreation}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
