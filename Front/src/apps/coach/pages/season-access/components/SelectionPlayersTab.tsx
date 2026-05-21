import React from "react";
import { Alert, Button, CircularProgress, Typography, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import TeamCard from "./TeamCard";
import styles from "../SeasonAccess.module.css";
import { ClubTeamCard } from "../helpers/seasonAccess.helpers";

type AnyFn = (...args: any[]) => any;

interface Props {
  selectedPlayers: any[];
  demarcations: any;
  handleRemoveSelectedPlayer: AnyFn;
  handleUpdateBirthYear: AnyFn;
  handleCommitBirthYear: AnyFn;
  handleTogglePossibleDemarcation: AnyFn;
  handleSetIdealDemarcation: AnyFn;
  clubsLoading: boolean;
  activeClub: any;
  error?: string | null;
  selectedCategory?: string | null;
  teamsLoading: boolean;
  groups: any[];
  selectedTeamCode?: string | null;
  setSelectedTeamCode: (code: string) => void;
  selectedTeam: any;
  players: any[];
  playersLoading: boolean;
  handleAddAllPlayers: AnyFn;
  handleTogglePlayer: (id: any) => void;
  seasonId?: string | null;
}

export default function SelectionPlayersTab(props: Props) {
  const {
    selectedPlayers,
    demarcations,
    handleRemoveSelectedPlayer,
    handleUpdateBirthYear,
    handleCommitBirthYear,
    handleTogglePossibleDemarcation,
    handleSetIdealDemarcation,
    clubsLoading,
    activeClub,
    error,
    selectedCategory,
    teamsLoading,
    groups,
    selectedTeamCode,
    setSelectedTeamCode,
    selectedTeam,
    players,
    playersLoading,
    handleAddAllPlayers,
    handleTogglePlayer,
  } = props;

  // hide from roster any players already added to the trial (selectedPlayers)
  const existingKeys = new Set((selectedPlayers ?? []).map((sp) => String((sp as any).federationPlayerCode ?? (sp as any).id)));
  const availablePlayers = (players ?? []).filter((p) => !existingKeys.has(String((p as any).federationPlayerCode ?? p.id)));

  return (
    <div className={styles.content}>
      {clubsLoading && (
        <div className={styles.loadingState}>
          <CircularProgress size={24} />
          <span>Cargando club asociado...</span>
        </div>
      )}

      {!clubsLoading && activeClub && (
        <Typography className={styles.clubMeta}>Club activo: {activeClub.clubName}</Typography>
      )}

      {error && <Alert severity="info">{error}</Alert>}

      {!clubsLoading && !selectedCategory && !error && (
        <div className={styles.emptyState}>
          Selecciona una categoría para cargar los equipos del club de esa categoría y la inmediatamente anterior.
        </div>
      )}

      {teamsLoading && (
        <div className={styles.loadingState}>
          <CircularProgress size={24} />
          <span>Cargando equipos del club...</span>
        </div>
      )}

      {!teamsLoading && selectedCategory && groups.length > 0 && (
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.label} className={styles.group}>
              <div className={styles.groupHeader}>
                <Typography variant="subtitle2" className={styles.groupTitle}>
                  {group.label}
                </Typography>
                <span className={styles.groupCount}>{group.teams.length}</span>
              </div>
              <div className={styles.teamGrid}>
                {group.teams.map((team: ClubTeamCard) => (
                  <TeamCard
                    key={team.teamCode}
                    team={team}
                    selected={selectedTeamCode === team.teamCode}
                    onSelect={() => setSelectedTeamCode(team.teamCode)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!teamsLoading && selectedCategory && groups.length === 0 && !error && !clubsLoading && (
        <Alert severity="info">No se encontraron equipos para {selectedCategory?.toLowerCase()} ni para la categoría anterior.</Alert>
      )}

      {selectedTeam && (
        <section className={styles.playerSection}>
          <div className={styles.playerSectionHeader}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleAddAllPlayers}
              disabled={players.length === 0}
              className={styles.addAllButton}
            >
              Añadir todos
            </Button>

            <div className={styles.playerSectionTitleWrap}>
              <Typography variant="subtitle2" className={styles.groupTitle}>
                Jugadores de {selectedTeam.teamName} - {selectedTeam.categoryDescription}
              </Typography>
              <span className={styles.groupCount}>{availablePlayers.length}</span>
            </div>
          </div>

          {playersLoading && (
            <div className={styles.loadingState}>
              <CircularProgress size={24} />
              <span>Cargando jugadores del equipo...</span>
            </div>
          )}

          {!playersLoading && availablePlayers.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Jugador</TableCell>
                  <TableCell>Edad</TableCell>
                  <TableCell>Goles</TableCell>
                  <TableCell>Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availablePlayers.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>{player.displayName}</TableCell>
                    <TableCell>{player.age != null ? `${player.age} años` : "—"}</TableCell>
                    <TableCell>{player.totalGoals != null ? `${player.totalGoals}` : "—"}</TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => handleTogglePlayer(player.id)}>
                        Traspasar a pruebas
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!playersLoading && availablePlayers.length === 0 && !error && (
            <Alert severity="info">No hay jugadores disponibles para este equipo.</Alert>
          )}
        </section>
      )}
    </div>
  );
}
