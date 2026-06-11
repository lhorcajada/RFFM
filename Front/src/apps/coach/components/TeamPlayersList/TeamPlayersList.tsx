import React from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Checkbox,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import PlayerCromo from "../../pages/season-access/components/PlayerCromo";
import { getPlayersByTeam, type PlayerResponse } from "../../services/teamplayerService";
import { getSeasonAccessSelection, getTrialDays, getTrialDayRatings } from "../../services/seasonAccessService";
import type { ClubTeam } from "../../../federation/services/Federation/ClubService";
import { normalizeText } from "../../pages/season-access/helpers/seasonAccess.helpers";
import styles from "./TeamPlayersList.module.css";

export type TeamPlayersListProps = {
  team: ClubTeam | null;
  seasonId?: string | null;
  category?: string | null;
  onPlayerSelect?: (player: PlayerResponse) => void;
  onSelectionChange?: (players: PlayerResponse[]) => void;
};

const playerDisplayName = (player: PlayerResponse) => {
  const fullName = `${player.name ?? ""} ${player.lastName ?? ""}`.trim();
  return player.alias?.trim() || fullName || "Jugador";
};

const playerSortName = (player: PlayerResponse) => {
  const fullName = `${player.name ?? ""} ${player.lastName ?? ""}`.trim();
  return fullName || player.alias?.trim() || "Jugador";
};

const playerSelectionKey = (player: PlayerResponse, fallbackIndex?: number) => {
  return (
    player.id ||
    player.playerId ||
    `${playerDisplayName(player)}-${player.dorsal ?? ""}`
  );
};

export default function TeamPlayersList({
  team,
  seasonId = null,
  category = null,
  onPlayerSelect,
  onSelectionChange,
}: TeamPlayersListProps) {
  const [players, setPlayers] = React.useState<PlayerResponse[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = React.useState<Set<string>>(new Set());
  const [playerSearch, setPlayerSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [existingKeys, setExistingKeys] = React.useState<Set<string>>(new Set());
  const [removedKeys, setRemovedKeys] = React.useState<Set<string>>(new Set());

  const selectablePlayers = React.useMemo(() => {
    return players.filter((player) => {
      const key = String((player as any).federationPlayerCode ?? player.playerId ?? player.id);
      return !existingKeys.has(key) && !removedKeys.has(key);
    });
  }, [existingKeys, players, removedKeys]);

  const filteredPlayers = React.useMemo(() => {
    const query = normalizeText(playerSearch);
    const sortedPlayers = selectablePlayers.slice().sort((left, right) => {
      const leftName = playerSortName(left);
      const rightName = playerSortName(right);
      return leftName.localeCompare(rightName, "es");
    });

    if (!query) return sortedPlayers;

    return sortedPlayers.filter((player) => {
      const candidates = [
        playerDisplayName(player),
        player.name ?? "",
        player.lastName ?? "",
        player.alias ?? "",
        player.age != null ? String(player.age) : "",
        player.birthYear != null ? String(player.birthYear) : "",
        player.team ?? "",
        player.teamCategory ?? "",
        player.dorsal != null ? String(player.dorsal) : "",
      ];

      return candidates.some((candidate) => normalizeText(candidate).includes(query));
    });
  }, [playerSearch, selectablePlayers]);

  const filteredPlayerKeys = React.useMemo(
    () => filteredPlayers.map((player, index) => playerSelectionKey(player, index)),
    [filteredPlayers]
  );
  const selectablePlayerKeys = React.useMemo(
    () => selectablePlayers.map((player, index) => playerSelectionKey(player, index)),
    [selectablePlayers]
  );
  const allSelectableSelected =
    selectablePlayerKeys.length > 0 &&
    selectablePlayerKeys.every((key) => selectedPlayerIds.has(key));
  const someSelectableSelected =
    selectablePlayerKeys.some((key) => selectedPlayerIds.has(key));

  const emitSelectionChange = (nextSelectionIds: Set<string>) => {
    setSelectedPlayerIds(nextSelectionIds);
    if (!onSelectionChange) return;

    const selectedPlayers = players.filter((player, index) =>
      nextSelectionIds.has(playerSelectionKey(player, index))
    );
    onSelectionChange(selectedPlayers);
  };

  React.useEffect(() => {
    let mounted = true;

    async function loadSeasonAccessState() {
      if (!seasonId || !category || !team) {
        setExistingKeys(new Set());
        setRemovedKeys(new Set());
        return;
      }

      try {
        const selection = await getSeasonAccessSelection(seasonId, category);
        const active = new Set<string>();
        const removed = new Set<string>();

        for (const sp of (selection?.players ?? [])) {
          try {
            const key = String((sp as any).federationPlayerCode ?? sp.id);
            const removedFrom = (sp as any).removedFromDate;
            if (!removedFrom) {
              active.add(key);
              continue;
            }
            removed.add(key);
          } catch {
            // ignore malformed entries
          }
        }

        const days = await getTrialDays(seasonId, category);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const d of days) {
          try {
            const ratings = await getTrialDayRatings(d.id);
            for (const r of ratings ?? []) {
              const key = String((r as any).federationPlayerCode ?? r.id);
              const removedFrom = (r as any).removedFromDate;
              if (!removedFrom) {
                active.add(key);
                continue;
              }

              let removedDate: Date | null = null;
              try {
                removedDate = new Date(String(removedFrom));
                if (Number.isNaN(removedDate.getTime())) {
                  removedDate = new Date(String(removedFrom) + "T00:00:00");
                }
              } catch {
                removedDate = null;
              }

              if (removedDate && !Number.isNaN(removedDate.getTime())) {
                if (removedDate <= today) removed.add(key);
                else active.add(key);
              } else {
                active.add(key);
              }
            }
          } catch {
            // ignore per-day errors
          }
        }

        if (!mounted) return;
        setExistingKeys(active);
        setRemovedKeys(removed);
      } catch {
        if (!mounted) return;
        setExistingKeys(new Set());
        setRemovedKeys(new Set());
      }
    }

    void loadSeasonAccessState();

    return () => {
      mounted = false;
    };
  }, [category, seasonId, team]);

  React.useEffect(() => {
    if (!team) {
      setPlayers([]);
      setSelectedPlayerIds(new Set());
      setPlayerSearch("");
      setError(null);
      return;
    }

    let mounted = true;

    async function loadPlayers() {
      setLoading(true);
      setError(null);

      try {
        const roster = await getPlayersByTeam(team.teamCode);
        if (!mounted) return;

        setPlayers(roster);
      } catch {
        if (mounted) {
          setPlayers([]);
          setSelectedPlayerIds(new Set());
          setError("No se pudieron cargar los jugadores del equipo seleccionado.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadPlayers();

    return () => {
      mounted = false;
    };
  }, [team]);

  React.useEffect(() => {
    setSelectedPlayerIds(new Set());
    setPlayerSearch("");
  }, [team?.teamCode, seasonId]);

  if (!team) {
    return null;
  }

  return (
    <Paper elevation={0} className={styles.panel}>
      <div className={styles.headerRow}>
        <div>
          <Typography variant="subtitle1" className={styles.panelTitle}>
            Jugadores del equipo
          </Typography>
          <Typography variant="body2" className={styles.panelText}>
            {team.teamName} · {team.categoryDescription}
          </Typography>
        </div>

          <Chip label={`${filteredPlayers.length}/${players.length}`} variant="outlined" size="small" />
      </div>

        <div className={styles.selectionBar}>
          <Checkbox
            checked={allSelectableSelected}
            indeterminate={!allSelectableSelected && someSelectableSelected}
            onChange={(event) => {
              const checked = event.target.checked;
              const next = new Set(selectedPlayerIds);
              if (checked) {
                selectablePlayerKeys.forEach((key) => next.add(key));
              } else {
                selectablePlayerKeys.forEach((key) => next.delete(key));
              }
              emitSelectionChange(next);
            }}
          />
          <Typography variant="body2" className={styles.selectionText}>
            Seleccionar todos
          </Typography>
          <Chip label={`${selectedPlayerIds.size} seleccionados`} variant="outlined" size="small" className={styles.selectionCount} />
        </div>

      <TextField
        size="small"
        fullWidth
        label="Buscar jugador"
        placeholder="Nombre, alias o dorsal"
        value={playerSearch}
        onChange={(event) => setPlayerSearch(event.target.value)}
      />

      <Divider />

      {loading ? (
        <div className={styles.loadingState}>
          <CircularProgress size={22} />
          <span>Cargando jugadores...</span>
        </div>
      ) : null}

      {error ? <Alert severity="info">{error}</Alert> : null}

      {!loading && !error && filteredPlayers.length === 0 ? (
        <Alert severity="info">No hay jugadores disponibles para esta categoría.</Alert>
      ) : null}

      {filteredPlayers.length > 0 ? (
        <Box className={styles.playersList}>
          {filteredPlayers.map((player, index) => {
            const selectionKey = playerSelectionKey(player, index);
            const isSelected = selectedPlayerIds.has(selectionKey);

            return (
              <PlayerCromo
                key={selectionKey}
                  player={{
                    id: selectionKey,
                    displayName: playerDisplayName(player),
                    teamName: player.team ?? team.teamName,
                    category: player.teamCategory ?? team.categoryDescription,
                    birthYear: player.birthYear ?? null,
                    age: player.age ?? null,
                    totalGoals: player.totalGoals ?? null,
                    federationPlayerCode: player.playerId ?? player.id,
                    status: null,
                    removedFromDate: null,
                  }}
                  selected={isSelected}
                  onSelect={() => {
                    const next = new Set(selectedPlayerIds);
                    if (next.has(selectionKey)) {
                      next.delete(selectionKey);
                    } else {
                      next.add(selectionKey);
                    }
                    emitSelectionChange(next);
                    onPlayerSelect?.(player);
                  }}
                  
              />
              );
            })}
        </Box>
      ) : null}
    </Paper>
  );
}