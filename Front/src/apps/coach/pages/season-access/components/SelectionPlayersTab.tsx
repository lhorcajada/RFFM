import React from "react";
import { Alert, Button, CircularProgress, Typography, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import TeamCard from "./TeamCard";
import styles from "../SeasonAccess.module.css";
import { ClubTeamCard } from "../helpers/seasonAccess.helpers";
import { getTrialDays, getTrialDayRatings } from "../../../services/seasonAccessService";

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
  const { seasonId } = props;
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

  // hide from roster any players already added to the trial (server ratings preferred)
  const [existingKeys, setExistingKeys] = React.useState<Set<string>>(new Set((selectedPlayers ?? []).map((sp) => String((sp as any).federationPlayerCode ?? (sp as any).id))));
  const [sendingKeys, setSendingKeys] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let mounted = true;
    async function loadRatings() {
      if (!seasonId || !selectedCategory) return;
      try {
        const days = await getTrialDays(seasonId, selectedCategory);
        const keys = new Set<string>();
        for (const d of days) {
          try {
            const ratings = await getTrialDayRatings(d.id);
            for (const r of (ratings ?? [])) keys.add(String(r.federationPlayerCode ?? r.id));
          } catch (e) {
            // ignore per-day errors
          }
        }
        if (mounted && keys.size > 0) setExistingKeys(keys);
      } catch (err) {
        // ignore
      }
    }

    void loadRatings();
    return () => { mounted = false; };
  }, [seasonId, selectedCategory]);

  // players available to send (not already in trials)
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
              onClick={async () => {
                // Add only players that are not already in trials
                const toAdd = (players ?? []).filter((p) => !existingKeys.has(String((p as any).federationPlayerCode ?? p.id)));
                if (toAdd.length === 0) return;
                for (const pl of toAdd) {
                  const key = String((pl as any).federationPlayerCode ?? pl.id);
                  try {
                    setSendingKeys((s) => new Set(s).add(key));
                    // await the parent handler to perform the save
                    await handleTogglePlayer(pl.id);

                    // verify server-side that the player is now present in any trial day
                    let confirmed = false;
                    if (seasonId && selectedCategory) {
                      try {
                        const days = await getTrialDays(seasonId, selectedCategory);
                        for (const d of days) {
                          try {
                            const ratings = await getTrialDayRatings(d.id);
                            if ((ratings ?? []).some((r) => String(r.federationPlayerCode ?? r.id) === key)) {
                              confirmed = true;
                              break;
                            }
                          } catch { /* ignore per-day */ }
                        }
                      } catch { /* ignore */ }
                    }

                    if (confirmed) setExistingKeys((s) => new Set(s).add(key));
                  } catch (e) {
                    // ignore per-player failures
                  } finally {
                    setSendingKeys((s) => {
                      const next = new Set(s);
                      next.delete(key);
                      return next;
                    });
                  }
                }
              }}
              disabled={players.length === 0 || availablePlayers.length === 0}
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

          {!playersLoading && players.length > 0 && (
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
                {players.map((player) => {
                  const key = String((player as any).federationPlayerCode ?? player.id);
                  const already = existingKeys.has(key);
                  const sending = sendingKeys.has(key);
                  return (
                    <TableRow key={player.id}>
                      <TableCell>{player.displayName}</TableCell>
                      <TableCell>{player.age != null ? `${player.age} años` : "—"}</TableCell>
                      <TableCell>{player.totalGoals != null ? `${player.totalGoals}` : "—"}</TableCell>
                      <TableCell>
                        {already ? (
                          <Button size="small" variant="outlined" disabled>
                            Enviado
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={async () => {
                              try {
                                setSendingKeys((s) => new Set(s).add(key));
                                await handleTogglePlayer(player.id);

                                // verify server-side that the player is now present in any trial day
                                let confirmed = false;
                                if (seasonId && selectedCategory) {
                                  try {
                                    const days = await getTrialDays(seasonId, selectedCategory);
                                    for (const d of days) {
                                      try {
                                        const ratings = await getTrialDayRatings(d.id);
                                        if ((ratings ?? []).some((r) => String(r.federationPlayerCode ?? r.id) === key)) {
                                          confirmed = true;
                                          break;
                                        }
                                      } catch { /* ignore per-day */ }
                                    }
                                  } catch { /* ignore */ }
                                }

                                if (confirmed) setExistingKeys((s) => new Set(s).add(key));
                              } catch (e) {
                                // ignore; handler shows errors
                              } finally {
                                setSendingKeys((s) => {
                                  const next = new Set(s);
                                  next.delete(key);
                                  return next;
                                });
                              }
                            }}
                            disabled={sending}
                          >
                            {sending ? "Enviando..." : "Traspasar a pruebas"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!playersLoading && players.length === 0 && !error && (
            <Alert severity="info">No hay jugadores disponibles para este equipo.</Alert>
          )}
        </section>
      )}
    </div>
  );
}
