import React from "react";

import { getUserClubs } from "../../../services/clubService";
import configurationCoachService from "../../../services/configurationCoachService";
import { getActiveSeason, type Season } from "../../../services/seasonService";
import {
  deleteSeasonAccessPlayer,
  getSeasonAccessDemarcations,
  getSeasonAccessSelection,
  getSeasonAccessSelectionsBySeason,
  saveSeasonAccessPlayer,
  type SeasonAccessDemarcation,
  type SeasonAccessPlayerPayload,
  type SeasonAccessSelectionPlayer,
} from "../../../services/seasonAccessService";
import type { UserClubsResponse } from "../../../types/userClubs";
import { clubService } from "../../../../federation/services/Federation/ClubService";
import { getPlayersByTeam } from "../../../../federation/services/api";
import {
  buildGroups,
  CATEGORY_ORDER,
  getSearchCandidates,
  normalizeCategory,
  normalizeText,
  type CategoryKey,
  type ClubTeamCard,
  type TeamGroup,
} from "../helpers/seasonAccess.helpers";
import type { SeasonAccessPlayer } from "../components/PlayerCromo";

function normalizeSelectedPlayer(
  player: {
    id: string;
    federationPlayerCode?: string;
    playerName?: string;
    displayName?: string;
    teamCode?: string;
    teamName?: string;
    category?: string;
    birthYear?: number | null;
    totalGoals?: number | null;
    possibleDemarcationIds?: number[];
    idealDemarcationId?: number | null;
  },
): SeasonAccessPlayer {
  function firstNonEmpty(...vals: Array<string | undefined | null>) {
    for (const v of vals) {
      if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed.length > 0) return trimmed;
      }
    }
    return "Jugador";
  }

  const displayName = firstNonEmpty(player.displayName, player.playerName);

  return {
    ...player,
    displayName,
    playerName: firstNonEmpty(player.playerName, player.displayName),
    teamCode: player.teamCode,
    teamName: player.teamName ?? "",
    category: player.category ?? "",
    birthYear: player.birthYear ?? null,
    possibleDemarcationIds: player.possibleDemarcationIds ?? [],
    idealDemarcationId: player.idealDemarcationId ?? null,
  };
}

function normalizeSelectedPlayers(players: SeasonAccessSelectionPlayer[] | SeasonAccessPlayer[]) {
  return players.map((player) => normalizeSelectedPlayer(player as {
    id: string;
    federationPlayerCode?: string;
    playerName?: string;
    displayName?: string;
    teamCode?: string;
    teamName?: string;
    category?: string;
    birthYear?: number | null;
    possibleDemarcationIds?: number[];
    idealDemarcationId?: number | null;
  }));
}

function extractTeamPosition(teamPayload: unknown, teamCode: string): number | null {
  const payload = teamPayload as {
    teamPosition?: number | null;
    players?: Array<{
      teamPosition?: number | null;
      competitions?: Array<{
        teamCode?: string | null;
        teamPosition?: number | null;
      }>;
    }>;
  };

  if (typeof payload.teamPosition === "number" && Number.isFinite(payload.teamPosition)) {
    return payload.teamPosition;
  }

  const roster = Array.isArray(payload.players) ? payload.players : [];
  const normalizedTeamCode = String(teamCode).trim();

  for (const player of roster) {
    if (typeof player.teamPosition === "number" && Number.isFinite(player.teamPosition)) {
      return player.teamPosition;
    }

    const competition = player.competitions?.find((item) => {
      const currentTeamCode = String(item.teamCode ?? "").trim();
      return currentTeamCode === normalizedTeamCode;
    });

    if (competition && typeof competition.teamPosition === "number" && Number.isFinite(competition.teamPosition)) {
      return competition.teamPosition;
    }

    const fallbackCompetition = player.competitions?.find(
      (item) => typeof item.teamPosition === "number" && Number.isFinite(item.teamPosition),
    );

    if (fallbackCompetition && typeof fallbackCompetition.teamPosition === "number") {
      return fallbackCompetition.teamPosition;
    }
  }

  return null;
}

async function findFederationClub(clubName: string) {
  const normalizedClubName = normalizeText(clubName);

  for (const candidate of getSearchCandidates(clubName)) {
    const results = await clubService.searchClubs(candidate);
    if (!results.length) continue;

    const exactMatch = results.find((club) => normalizeText(club.name) === normalizedClubName);
    if (exactMatch) return exactMatch;

    return results[0] ?? null;
  }

  return null;
}

export default function useSeasonAccess() {
  const [selectedCategory, setSelectedCategory] = React.useState<CategoryKey | null>(null);
  const [selectedTeamCode, setSelectedTeamCode] = React.useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = React.useState<SeasonAccessPlayer[]>([]);
  const [trialId, setTrialId] = React.useState<string | null>(null);
  const [activeSeason, setActiveSeason] = React.useState<Season | null>(null);
  const [demarcations, setDemarcations] = React.useState<SeasonAccessDemarcation[]>([]);
  const [activeClub, setActiveClub] = React.useState<UserClubsResponse | null>(null);
  const [clubsLoading, setClubsLoading] = React.useState(true);
  const [teamsLoading, setTeamsLoading] = React.useState(false);
  const [playersLoading, setPlayersLoading] = React.useState(false);
  const [selectionLoading, setSelectionLoading] = React.useState(false);
  const [catalogLoading, setCatalogLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [groups, setGroups] = React.useState<TeamGroup[]>([]);
  const [players, setPlayers] = React.useState<SeasonAccessPlayer[]>([]);
  const lastLoadedTeamRef = React.useRef<string | null>(null);
  const hydratedSeasonSelectionRef = React.useRef<string | null>(null);

  const selectedTeam = React.useMemo(() => {
    if (!selectedTeamCode) return null;
    return groups.flatMap((group) => group.teams).find((team) => team.teamCode === selectedTeamCode) ?? null;
  }, [groups, selectedTeamCode]);

  const handleSelectCategory = React.useCallback((category: CategoryKey) => {
    setSelectedCategory(category);
    setSelectedTeamCode(null);
    setPlayers([]);
    setSelectedPlayers([]);
  }, []);

  const handleTogglePlayer = React.useCallback(
    async (playerId: string) => {
      const existing = selectedPlayers.find((player) => player.id === playerId);

      if (existing) {
        try {
          const deleteCategory =
            existing.category ?? selectedTeam?.categoryDescription ?? selectedCategory ?? "";
          if (!activeSeason?.id || !deleteCategory) {
            throw new Error("Faltan datos para eliminar el jugador seleccionado.");
          }

          const result = await deleteSeasonAccessPlayer(
            activeSeason.id,
            deleteCategory,
            existing.federationPlayerCode ?? existing.id,
          );

          setSelectedPlayers(normalizeSelectedPlayers(result?.players ?? []));
        } catch {
          setError("No se pudo quitar el jugador seleccionado.");
          void reloadSelection();
        }

        return;
      }

      const rosterPlayer = players.find((item) => item.id === playerId);
      const payload = rosterPlayer ? buildPayloadFromPlayer(rosterPlayer) : null;

      if (!payload) return;

      try {
        const result = await saveSeasonAccessPlayer(payload);
        setSelectedPlayers(normalizeSelectedPlayers(result?.players ?? []));
        if (result?.id) setTrialId(result.id);
      } catch {
        setError("No se pudo guardar el jugador seleccionado.");
        void reloadSelection();
      }
    },
    [activeSeason?.id, buildPayloadFromPlayer, players, reloadSelection, selectedCategory, selectedPlayers],
  );

  const handleAddAllPlayers = React.useCallback(async () => {
    const missingPlayers = players.filter(
      (player) => !selectedPlayers.some((selectedPlayer) => selectedPlayer.id === player.id),
    );

    if (missingPlayers.length === 0) {
      return;
    }

    try {
      for (const player of missingPlayers) {
        const payload = buildPayloadFromPlayer(player);
        if (!payload) continue;
        const result = await saveSeasonAccessPlayer(payload);
        setSelectedPlayers(normalizeSelectedPlayers(result?.players ?? []));
      }
    } catch {
      setError("No se pudieron guardar todos los jugadores.");
      void reloadSelection();
    }
  }, [buildPayloadFromPlayer, players, reloadSelection, selectedPlayers]);

  const handleUpdateBirthYear = React.useCallback(
    (playerId: string, birthYear: number | null) => {
      setSelectedPlayers((current) =>
        current.map((player) => (player.id === playerId ? { ...player, birthYear } : player)),
      );
    },
    [],
  );

  const handleCommitBirthYear = React.useCallback(
    async (playerId: string) => {
      const player = selectedPlayers.find((item) => item.id === playerId);
      if (!player) return;

      await persistSelectedPlayerSnapshot(player);
    },
    [persistSelectedPlayerSnapshot, selectedPlayers],
  );

  const handleTogglePossibleDemarcation = React.useCallback(
    (playerId: string, demarcationId: number) => {
      const currentPlayer = selectedPlayers.find((player) => player.id === playerId);
      if (!currentPlayer) return;

      const currentIds = new Set(currentPlayer.possibleDemarcationIds ?? []);
      if (currentIds.has(demarcationId)) {
        currentIds.delete(demarcationId);
      } else {
        currentIds.add(demarcationId);
      }

      const possibleDemarcationIds = Array.from(currentIds);
      const idealDemarcationId =
        currentPlayer.idealDemarcationId != null && possibleDemarcationIds.includes(currentPlayer.idealDemarcationId)
          ? currentPlayer.idealDemarcationId
          : possibleDemarcationIds[0] ?? null;

      const nextPlayer = {
        ...currentPlayer,
        possibleDemarcationIds,
        idealDemarcationId,
      };

      setSelectedPlayers((current) =>
        current.map((player) => (player.id === playerId ? nextPlayer : player)),
      );

      void persistSelectedPlayerSnapshot(nextPlayer);
    },
    [persistSelectedPlayerSnapshot, selectedPlayers],
  );

  const handleSetIdealDemarcation = React.useCallback(
    (playerId: string, demarcationId: number | null) => {
      const currentPlayer = selectedPlayers.find((player) => player.id === playerId);
      if (!currentPlayer) return;

      const possibleDemarcationIds =
        demarcationId == null
          ? currentPlayer.possibleDemarcationIds ?? []
          : Array.from(new Set([...(currentPlayer.possibleDemarcationIds ?? []), demarcationId]));

      const nextPlayer = {
        ...currentPlayer,
        possibleDemarcationIds,
        idealDemarcationId: demarcationId,
      };

      setSelectedPlayers((current) =>
        current.map((player) => (player.id === playerId ? nextPlayer : player)),
      );

      void persistSelectedPlayerSnapshot(nextPlayer);
    },
    [persistSelectedPlayerSnapshot, selectedPlayers],
  );

  const handleRemoveSelectedPlayer = React.useCallback(
    async (playerId: string) => {
      const player = selectedPlayers.find((item) => item.id === playerId);
      if (!player || !activeSeason?.id) return;

      const deleteCategory = player.category ?? selectedTeam?.categoryDescription ?? selectedCategory ?? "";
      if (!deleteCategory) return;

      try {
        const result = await deleteSeasonAccessPlayer(
          activeSeason.id,
          deleteCategory,
          player.federationPlayerCode ?? player.id,
        );
        setSelectedPlayers(normalizeSelectedPlayers(result?.players ?? []));
      } catch {
        setError("No se pudo quitar el jugador seleccionado.");
        void reloadSelection();
      }
    },
    [activeSeason?.id, reloadSelection, selectedCategory, selectedPlayers],
  );

  React.useEffect(() => {
    let mounted = true;

    async function loadCatalogs() {
      setCatalogLoading(true);

      try {
        const [season, demarcationCatalog] = await Promise.all([
          getActiveSeason(),
          getSeasonAccessDemarcations(),
        ]);

        if (!mounted) return;

        setActiveSeason(season);
        setDemarcations(demarcationCatalog);
      } catch {
        if (mounted) {
          setActiveSeason(null);
          setDemarcations([]);
        }
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    }

    void loadCatalogs();

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    async function hydrateSavedSeasonSelection() {
      if (!activeSeason?.id || selectedCategory || hydratedSeasonSelectionRef.current === activeSeason.id) {
        return;
      }

      setSelectionLoading(true);

      try {
        const selections = await getSeasonAccessSelectionsBySeason(activeSeason.id);
        if (!mounted) return;

        const initialSelection =
          CATEGORY_ORDER.map((category) => selections.find((selection) => selection.category === category)).find(
            (selection): selection is (typeof selections)[number] => selection != null,
          ) ??
          selections[0] ??
          null;

        hydratedSeasonSelectionRef.current = activeSeason.id;

        if (initialSelection) {
          setSelectedCategory(initialSelection.category as CategoryKey);
          setSelectedPlayers(normalizeSelectedPlayers(initialSelection.players ?? []));
          setTrialId(initialSelection.id || null);
        }
      } catch {
        if (mounted) {
          hydratedSeasonSelectionRef.current = activeSeason.id;
        }
      } finally {
        if (mounted) setSelectionLoading(false);
      }
    }

    void hydrateSavedSeasonSelection();

    return () => {
      mounted = false;
    };
  }, [activeSeason?.id, selectedCategory]);

  React.useEffect(() => {
    let mounted = true;

    async function loadSelection() {
      if (!activeSeason?.id || !selectedCategory) {
        return;
      }

      setSelectionLoading(true);

      try {
        const selection = await getSeasonAccessSelection(activeSeason.id, selectedCategory);
        if (!mounted) return;

        setSelectedPlayers(normalizeSelectedPlayers(selection?.players ?? []));
        setTrialId(selection?.id || null);
      } catch {
        if (mounted) {
          setSelectedPlayers([]);
          setTrialId(null);
          setError("No se pudo cargar la selección guardada.");
        }
      } finally {
        if (mounted) setSelectionLoading(false);
      }
    }

    void loadSelection();

    return () => {
      mounted = false;
    };
  }, [activeSeason?.id, selectedCategory]);

  React.useEffect(() => {
    let mounted = true;

    async function loadClub() {
      setClubsLoading(true);
      setSelectedTeamCode(null);
      setPlayers([]);
      try {
        const [configs, userClubs] = await Promise.all([
          configurationCoachService.getAll(),
          getUserClubs(),
        ]);

        if (!mounted) return;

        const preferredClubId = configs[0]?.preferredClubId ?? null;
        const chosenClub =
          userClubs.find((club: UserClubsResponse) => club.clubId === preferredClubId) ??
          userClubs[0] ??
          null;

        setActiveClub(chosenClub);

        if (!chosenClub) {
          setError("No hay un club asociado al usuario.");
        }
      } catch {
        if (mounted) {
          setActiveClub(null);
          setError("No se pudo cargar el club asociado al usuario.");
        }
      } finally {
        if (mounted) setClubsLoading(false);
      }
    }

    void loadClub();

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    async function loadTeams() {
      if (!activeClub || !selectedCategory) {
        setGroups([]);
        setSelectedTeamCode(null);
        setPlayers([]);
        return;
      }

      setTeamsLoading(true);
      setError(null);

      try {
        const federationClub = await findFederationClub(activeClub.clubName);

        if (!federationClub) {
          throw new Error("No se encontró el club en Federación.");
        }

        const clubTeams = await clubService.getClubTeams(federationClub.clubCode);
        if (!mounted) return;

        // Do not fetch players for every team on initial load to avoid timeouts.
        // Load only team metadata and fetch players when the user selects a team.
        const normalizedTeams: ClubTeamCard[] = clubTeams.map((team) => ({
          ...team,
          categoryKey: normalizeCategory(team.categoryDescription),
          position: null,
        }));

        const nextGroups = buildGroups(normalizedTeams, selectedCategory);
        setGroups(nextGroups);
      } catch {
        if (mounted) {
          setGroups([]);
          setSelectedTeamCode(null);
          setPlayers([]);
          setError("No se pudieron cargar los equipos del club.");
        }
      } finally {
        if (mounted) setTeamsLoading(false);
      }
    }

    void loadTeams();

    return () => {
      mounted = false;
    };
  }, [activeClub, selectedCategory]);

  function buildPayloadFromPlayer(player: SeasonAccessPlayer): SeasonAccessPlayerPayload | null {
    if (!activeSeason?.id) {
      return null;
    }

    const payloadCategory = player.category ?? selectedTeam?.categoryDescription ?? selectedCategory ?? "";
    if (!payloadCategory) return null;

    return {
      seasonId: activeSeason.id,
      category: payloadCategory,
      federationPlayerCode: player.federationPlayerCode ?? player.id,
      playerName: player.playerName ?? player.displayName,
      teamCode: player.teamCode ?? selectedTeam?.teamCode ?? "",
      teamName: player.teamName,
      totalGoals: player.totalGoals ?? null,
      birthYear: player.birthYear ?? null,
      possibleDemarcationIds: player.possibleDemarcationIds ?? [],
      idealDemarcationId: player.idealDemarcationId ?? null,
    };
  }

  async function reloadSelection() {
    if (!activeSeason?.id || !selectedCategory) {
      setSelectedPlayers([]);
      return;
    }

    const selection = await getSeasonAccessSelection(activeSeason.id, selectedCategory);
    setSelectedPlayers(normalizeSelectedPlayers(selection?.players ?? []));
  }

  async function persistSelectedPlayerSnapshot(player: SeasonAccessPlayer) {
    const payload = buildPayloadFromPlayer(player);
    if (!payload) return;

    try {
      const result = await saveSeasonAccessPlayer(payload);
      setSelectedPlayers(normalizeSelectedPlayers(result?.players ?? []));
    } catch {
      setError("No se pudo guardar la ficha del jugador seleccionado.");
      void reloadSelection();
    }
  }

  React.useEffect(() => {
    let mounted = true;

    async function loadPlayers() {
      if (!activeClub || !selectedTeam) {
        lastLoadedTeamRef.current = null;
        setPlayers([]);
        setPlayersLoading(false);
        return;
      }

      // If we already loaded players for this team, avoid refetching
      if (lastLoadedTeamRef.current === selectedTeam.teamCode) {
        return;
      }

      setPlayersLoading(true);
      setError(null);

      try {
        const payload = await getPlayersByTeam(selectedTeam.teamCode);
        if (!mounted) return;

        // compute team position from the team payload and update groups if changed
        try {
          const position = extractTeamPosition(payload, selectedTeam.teamCode);
          setGroups((prev) => {
            let changed = false;
            const next = prev.map((g) => ({
              ...g,
              teams: g.teams.map((t) => {
                if (t.teamCode !== selectedTeam.teamCode) return t;
                if (t.position === position) return t;
                changed = true;
                return { ...t, position };
              }),
            }));
            return changed ? next : prev;
          });
        } catch {
          // ignore failures when extracting position
        }

        const payloadData = payload as unknown as {
          players?: unknown[];
          jugadores_equipo?: unknown[];
        };

        const roster = Array.isArray(payload)
          ? payload
          : Array.isArray(payloadData.players)
            ? (payloadData.players ?? [])
            : Array.isArray(payloadData.jugadores_equipo)
              ? (payloadData.jugadores_equipo ?? [])
              : [];

        const hydratedPlayers = await Promise.all(
          roster.map(async (item, index) => {
            const source = item as {
              id?: string | number;
              playerId?: string | number;
              name?: string | null;
              lastName?: string | null;
              alias?: string | null;
              team?: string | null;
              teamName?: string | null;
              age?: number | null;
              birthYear?: number | null;
            };

            const playerId = source.playerId ?? source.id ?? `${selectedTeam.teamCode}-${index}`;
            const displayName =
              `${source.name ?? ""} ${source.lastName ?? ""}`.trim() ||
              source.alias ||
              "Jugador";
            const age =
              typeof source.age === "number" && Number.isFinite(source.age)
                ? source.age
                : typeof source.birthYear === "number" && Number.isFinite(source.birthYear)
                  ? new Date().getFullYear() - source.birthYear
                  : null;

            // try to extract total goals from multiple possible fields
            const rawGoals = (source as any)?.matches?.totalGoals ?? (source as any)?.goles ?? (source as any)?.partidos?.goles_total ?? (source as any)?.goles_total ?? null;
            const totalGoals = typeof rawGoals === "number" && Number.isFinite(rawGoals)
              ? rawGoals
              : typeof rawGoals === "string" && rawGoals.trim() !== "" && !Number.isNaN(Number(rawGoals))
                ? Number(rawGoals)
                : null;

            return {
              id: String(playerId),
              displayName,
              teamName: (source.team ?? source.teamName ?? selectedTeam.teamName) || selectedTeam.teamName,
              teamCode: selectedTeam.teamCode,
              category: selectedTeam.categoryDescription,
              birthYear: null,
              totalGoals,
              possibleDemarcationIds: [],
              idealDemarcationId: null,
              age,
            } satisfies SeasonAccessPlayer;
          })
        );

        hydratedPlayers.sort((left, right) => {
          if (left.age == null && right.age == null) return left.displayName.localeCompare(right.displayName, "es");
          if (left.age == null) return 1;
          if (right.age == null) return -1;
          if (left.age !== right.age) return left.age - right.age;
          return left.displayName.localeCompare(right.displayName, "es");
        });

        setPlayers(hydratedPlayers);
        lastLoadedTeamRef.current = selectedTeam.teamCode;
      } catch {
        if (mounted) {
          setPlayers([]);
          setError("No se pudieron cargar los jugadores del equipo.");
        }
      } finally {
        if (mounted) setPlayersLoading(false);
      }
    }

    void loadPlayers();

    return () => {
      mounted = false;
    };
  }, [activeClub, selectedTeam?.teamCode]);

  return {
    activeClub,
    activeSeason,
    trialId,
    demarcations,
    clubsLoading,
    catalogLoading,
    teamsLoading,
    playersLoading,
    selectionLoading,
    error,
    groups,
    selectedCategory,
    setSelectedCategory: handleSelectCategory,
    selectedTeamCode,
    selectedTeam,
    players,
    selectedPlayers,
    handleTogglePlayer,
    handleAddAllPlayers,
    handleUpdateBirthYear,
    handleCommitBirthYear,
    handleTogglePossibleDemarcation,
    handleSetIdealDemarcation,
    handleRemoveSelectedPlayer,
    setSelectedTeamCode,
  };
}
