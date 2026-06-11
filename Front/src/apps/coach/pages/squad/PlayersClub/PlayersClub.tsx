import React from "react";
import { Alert, Box, Button, Chip, Divider, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { useLocation, useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import TeamPlayersList from "../../../components/TeamPlayersList/TeamPlayersList";
import useTeamAndClub from "../../../hooks/useTeamAndClub";
import type { PlayerResponse } from "../../../services/teamplayerService";
import { addPlayerToTeam } from "../../../services/teamplayerService";
import styles from "./PlayersClub.module.css";

export default function PlayersClub() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { team, loading: teamLoading } = useTeamAndClub();
  const params = new URLSearchParams(search);
  const teamId = params.get("teamId");
  const seasonId = params.get("seasonId");
  const [selectedPlayers, setSelectedPlayers] = React.useState<PlayerResponse[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const clubTeam = React.useMemo(() => {
    if (!team) return null;

    return {
      teamCode: team.id,
      teamName: team.name,
      categoryDescription: team.category?.name ?? "Sin categoría",
      inCompetition: false,
      competitionId: null,
      competitionName: null,
    };
  }, [team]);

  const selectedCount = selectedPlayers.length;

  const handleBack = () => {
    if (teamId) {
      navigate(`/coach/squad${search}`);
      return;
    }

    navigate("/coach/squad");
  };

  const handleSaveSelected = async () => {
    if (!team) return;
    if (selectedPlayers.length === 0) {
      setSaveMessage("Selecciona al menos un jugador antes de guardar.");
      return;
    }

    const clubId = team.club?.id?.trim();
    if (!clubId) {
      setSaveMessage("No se puede guardar porque el equipo activo no tiene club asociado.");
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    let saved = 0;
    let skipped = 0;
    const failedPlayers: string[] = [];

    try {
      for (const player of selectedPlayers) {
        const playerName = player.name?.trim() ?? "";
        const firstName = playerName || player.alias?.trim() || "Jugador";
        const lastName = player.lastName?.trim() || null;
        const alias = player.alias?.trim() || firstName;

        try {
          await addPlayerToTeam({
            teamId: team.id,
            clubId,
            playerId: player.playerId ?? player.id ?? null,
            name: firstName,
            lastName,
            alias,
            dorsal: player.dorsal ?? null,
            position: player.position ?? null,
            urlPhoto: player.urlPhoto ?? null,
          });
          saved += 1;
        } catch (error) {
          skipped += 1;
          failedPlayers.push(player.alias || firstName);
          // Keep the failure visible during debugging; the UI message is updated after the loop.
          console.error("Failed to add player to team", {
            teamId: team.id,
            clubId,
            playerId: player.playerId ?? player.id ?? null,
            error,
          });
        }
      }

      setSaveMessage(
        skipped > 0
          ? saved > 0
            ? `Guardados ${saved} jugadores. ${skipped} no se pudieron procesar.`
            : `No se pudo guardar ninguno de los ${skipped} jugadores seleccionados.`
          : `Guardados ${saved} jugadores.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Jugadores del club"
        subtitle="Selecciona jugadores del club para incorporarlos a la plantilla"
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<GroupAddIcon />}
              onClick={handleSaveSelected}
              disabled={!team || isSaving || selectedCount === 0}
            >
              Añadir seleccionados
            </Button>
          </>
        }
      >
        <Box className={styles.page}>
          <Box className={styles.headerCard}>
            <Stack spacing={1.25} className={styles.headerCopy}>
              <Chip
                label={teamId ? "Contexto de plantilla activo" : "Sin plantilla seleccionada"}
                size="small"
                variant="outlined"
                color="primary"
                className={styles.contextChip}
              />
              <Typography variant="h5" className={styles.title}>
                Elige qué jugadores del club quieres mover a la plantilla
              </Typography>
              <Typography variant="body2" className={styles.description}>
                Esta pantalla queda preparada para listar jugadores, filtrar por temporada y
                revisar qué futbolistas aún no están en el equipo.
              </Typography>
            </Stack>

            <Box className={styles.summaryPanel}>
              <Typography variant="overline" className={styles.summaryLabel}>
                Resumen
              </Typography>
              <Stack spacing={1}>
                <div className={styles.summaryItem}>
                  <span>Equipo</span>
                  <strong>{team?.name ?? teamId ?? "No seleccionado"}</strong>
                </div>
                <Divider className={styles.divider} />
                <div className={styles.summaryItem}>
                  <span>Temporada</span>
                  <strong>{seasonId ?? "Sin temporada"}</strong>
                </div>
                <Divider className={styles.divider} />
                <div className={styles.summaryItem}>
                  <span>Seleccionados</span>
                  <strong>{selectedCount}</strong>
                </div>
              </Stack>
            </Box>
          </Box>

          <Box className={styles.workspace}>
            {saveMessage ? (
              <Alert severity={selectedCount > 0 ? "success" : "info"} className={styles.alert}>
                {saveMessage}
              </Alert>
            ) : null}

            <Box className={styles.filterBar}>
              <Typography variant="subtitle2" className={styles.filterTitle}>
                Filtros y búsqueda
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label="Todos" size="small" />
                <Chip label="Con ficha" size="small" variant="outlined" />
                <Chip label="Sin ficha" size="small" variant="outlined" />
                <Chip label="Temporada actual" size="small" variant="outlined" />
              </Stack>
            </Box>

            {teamLoading ? (
              <Box className={styles.emptyStage}>
                <div className={styles.emptyBadge}>Cargando</div>
                <Typography variant="h6" className={styles.emptyTitle}>
                  Cargando equipo y jugadores
                </Typography>
                <Typography variant="body2" className={styles.emptyText}>
                  Estamos recuperando la plantilla activa para poder seleccionar y guardar jugadores.
                </Typography>
              </Box>
            ) : clubTeam ? (
              <Box className={styles.listStage}>
                <TeamPlayersList
                  team={clubTeam}
                  seasonId={seasonId}
                  onSelectionChange={setSelectedPlayers}
                />
              </Box>
            ) : (
              <Box className={styles.emptyStage}>
                <div className={styles.emptyBadge}>Próximo paso</div>
                <Typography variant="h6" className={styles.emptyTitle}>
                  No hay un equipo activo para mostrar jugadores
                </Typography>
                <Typography variant="body2" className={styles.emptyText}>
                  Vuelve a la pantalla anterior y selecciona una plantilla antes de añadir jugadores del club.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}