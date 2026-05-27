import React from "react";
import { Alert, Button, CircularProgress, Typography, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import TeamCard from "../TeamCard";
import styles from "../../SeasonAccess.module.css";
import { ClubTeamCard } from "../../helpers/seasonAccess.helpers";
import { getTrialDays, getTrialDayRatings, saveSeasonAccessPlayer } from "../../../../services/seasonAccessService";

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
  reloadSelection?: () => Promise<void>;
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
    reloadSelection,
  } = props;

  // hide from roster any players already added to the trial (server ratings preferred)
  const [existingKeys, setExistingKeys] = React.useState<Set<string>>(new Set());
  // keys for players that have been removed/marked as deleted on the server
  const [removedKeys, setRemovedKeys] = React.useState<Set<string>>(new Set());
  const [sendingKeys, setSendingKeys] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let mounted = true;
    async function loadRatings() {
      if (!seasonId || !selectedCategory) return;
      try {
        const days = await getTrialDays(seasonId, selectedCategory);

        // Map key -> aggregated flags about ratings
        const map = new Map<string, { hasRating: boolean; hasUnremoved: boolean; hasFutureRemove: boolean; hasPastRemove: boolean }>();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const d of days) {
          try {
            const ratings = await getTrialDayRatings(d.id);
            for (const r of (ratings ?? [])) {
              const key = String((r as any).federationPlayerCode ?? r.id);
              const entry = map.get(key) ?? { hasRating: false, hasUnremoved: false, hasFutureRemove: false, hasPastRemove: false };
              entry.hasRating = true;
              const removedFrom = (r as any).removedFromDate;
              if (!removedFrom) {
                entry.hasUnremoved = true;
              } else {
                let removedDate: Date | null = null;
                try {
                  removedDate = new Date(String(removedFrom));
                  if (Number.isNaN(removedDate.getTime())) {
                    removedDate = new Date(String(removedFrom) + "T00:00:00");
                  }
                } catch {}
                if (removedDate && !Number.isNaN(removedDate.getTime())) {
                  if (removedDate <= today) entry.hasPastRemove = true;
                  else entry.hasFutureRemove = true;
                } else {
                  // unknown format -> treat as unremoved
                  entry.hasUnremoved = true;
                }
              }
              map.set(key, entry);
            }
          } catch (e) {
            // ignore per-day errors
          }
        }

        const active = new Set<string>();
        const removed = new Set<string>();

        for (const [key, info] of map.entries()) {
          // Consider removed when there's at least one rating with a removedFromDate (past or future)
          // and there are no unremoved ratings for that player.
          const isRemoved = info.hasRating && (info.hasPastRemove || info.hasFutureRemove) && !info.hasUnremoved;
          if (isRemoved) removed.add(key);
          else if (info.hasRating) active.add(key);
        }

        if (mounted) {
          setExistingKeys(active);
          setRemovedKeys(removed);
        }
      } catch (err) {
        // ignore
      }
    }

    void loadRatings();
    return () => { mounted = false; };
  }, [seasonId, selectedCategory]);

  // Also derive initial existing/removed keys from the current `selectedPlayers` snapshot
  React.useEffect(() => {
    try {
      const active = new Set<string>();
      const removed = new Set<string>();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const sp of (selectedPlayers ?? [])) {
        try {
          const key = String((sp as any).federationPlayerCode ?? sp.id);
          const removedFrom = (sp as any).removedFromDate;
          if (!removedFrom) {
            active.add(key);
            continue;
          }
          // If there's any removedFromDate present on the saved selection, treat the player as removed
          removed.add(key);
        } catch {}
      }

      setExistingKeys((prev) => {
        const next = new Set(prev);
        // removed keys should not be present in existing
        for (const k of removed) next.delete(k);
        for (const k of active) if (!removed.has(k)) next.add(k);
        return next;
      });
      setRemovedKeys((prev) => {
        const next = new Set(prev);
        for (const k of active) next.delete(k);
        for (const k of removed) next.add(k);
        return next;
      });
    } catch {}
  }, [selectedPlayers]);

  // players available to send (not already in trials and not removed)
  const availablePlayers = (players ?? []).filter((p) => {
    const key = String((p as any).federationPlayerCode ?? p.id);
    return !existingKeys.has(key) && !removedKeys.has(key);
  });

  // debugging effect removed

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
                // Add only players that are not already in trials and not marked removed
                const toAdd = (players ?? []).filter((p) => {
                  const key = String((p as any).federationPlayerCode ?? p.id);
                  return !existingKeys.has(key) && !removedKeys.has(key);
                });
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
                  const alreadyActive = existingKeys.has(key);
                  const removed = removedKeys.has(key);
                  const sending = sendingKeys.has(key);
                  return (
                    <TableRow key={player.id}>
                      <TableCell>{player.displayName}</TableCell>
                      <TableCell>{player.age != null ? `${player.age} años` : "—"}</TableCell>
                      <TableCell>{player.totalGoals != null ? `${player.totalGoals}` : "—"}</TableCell>
                      <TableCell>
                        {alreadyActive ? (
                          <Button size="small" variant="outlined" disabled>
                            Enviado
                          </Button>
                        ) : removed ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={async () => {
                              try {
                                setSendingKeys((s) => new Set(s).add(key));

                                if (!seasonId || !selectedCategory) {
                                  window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Faltan temporada o categoría.', severity: 'warning' } }));
                                  return;
                                }

                                const days = await getTrialDays(seasonId, selectedCategory);
                                if (!days || days.length === 0) {
                                  window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Debes crear al menos un día de prueba para esa categoría.', severity: 'warning' } }));
                                  return;
                                }

                                const firstDayId = days[0].id;

                                const payload = {
                                  seasonId,
                                  category: selectedCategory,
                                  divisionCategory: player.category ?? selectedTeam?.categoryDescription ?? null,
                                  federationPlayerCode: String((player as any).federationPlayerCode ?? player.id),
                                  playerName: (player as any).playerName ?? player.displayName ?? 'Jugador',
                                  teamCode: (player as any).teamCode ?? player.teamName ?? 'manual',
                                  teamName: (player as any).teamName ?? player.teamCode ?? 'manual',
                                  birthYear: (player as any).birthYear ?? null,
                                  status: (player as any).status ?? null,
                                  totalGoals: (player as any).totalGoals ?? null,
                                  possibleDemarcationIds: (player as any).possibleDemarcationIds ?? [],
                                  idealDemarcationId: (player as any).idealDemarcationId ?? null,
                                  trialDayId: firstDayId,
                                } as any;

                                await saveSeasonAccessPlayer(payload);

                                setExistingKeys((s) => new Set(s).add(key));
                                setRemovedKeys((s) => {
                                  const next = new Set(s);
                                  next.delete(key);
                                  return next;
                                });

                                try {
                                  if (reloadSelection) await reloadSelection();
                                } catch {}

                                window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'Jugador activado en pruebas.', severity: 'success' } }));
                              } catch (err) {
                                window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: 'No se pudo activar el jugador.', severity: 'error' } }));
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
                            {sending ? "Procesando..." : "Activar"}
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
