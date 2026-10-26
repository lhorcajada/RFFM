import { Box, Button, Stack, Tab, Tabs } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import SquadRatings from "./components/SquadRatings";
import SquadRanking from "./components/SquadRanking";
import IdealLineup from "./components/IdealLineup";
import SquadPlayerCard from "./components/SquadPlayerCard";
import SquadSummary from "./components/SquadSummary";
import SquadFilters from "./components/SquadFilters";
import { categoryAccent, positionCategory } from "./rating/positionCategory";
import { CATEGORY_ORDER, positionCategoryLabel } from "./utils/positionGroups";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { coachAuthService } from "../../services/authService";
import { getMyProfile } from "../../services/coachApi";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import teamplayerService from "../../services/teamplayerService";
import { dischargeActiveInjury } from "../../services/teamplayerService";
import playerService from "../../services/playerService";
import playerRatingService from "../../services/playerRatingService";
import { getTeamLeagueStats } from "../../services/leagueStatsService";
import type { LeaguePlayerStats } from "../../services/leagueStatsService";
import { getTeamPlayerStatistics } from "../../services/teamPlayerStatisticsService";
import type { PlayerStatistics } from "../../services/teamPlayerStatisticsService";
import SquadStatistics from "./components/SquadStatistics";
import PlayerFormLegend from "../../components/PlayerFormLegend/PlayerFormLegend";
import type { PlayerRating } from "../../types/playerRating";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";
import styles from "./Squad.module.css";

const useTabState = useState;

export default function Squad() {
  useAuditPageAccess('Squad');
  const navigate = useNavigate();
  const goToTeamDashboard = useTeamDashboardBack();
  const [squadSearchParams] = useSearchParams();
  const { team, teamTitleNode } = useTeamAndClub();
  const [players, setPlayers] = useState<any[]>([]);
  const [playerPhotos, setPlayerPhotos] = useState<Record<string, string | null>>({});
  const [latestRatings, setLatestRatings] = useState<Record<string, PlayerRating>>({});
  const [leagueStats, setLeagueStats] = useState<Record<string, LeaguePlayerStats>>({});
  const [playerStats, setPlayerStats] = useState<PlayerStatistics[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const roles = useMemo(
    () => coachAuthService.getRoles().map((role) => role.toLowerCase()),
    []
  );
  const isAdminOrCoach =
    roles.includes("administrator") ||
    roles.includes("admin") ||
    roles.includes("coach");
  const isFan =
    (roles.includes("fan") || roles.includes("follower")) &&
    !isAdminOrCoach;
  const isPlayerOrFamily =
    (roles.includes("player") ||
      roles.includes("familyplayer") ||
      roles.includes("familymember")) &&
    !isAdminOrCoach;
  const isRestricted = isFan || isPlayerOrFamily;

  const [associatedPlayerId, setAssociatedPlayerId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(isPlayerOrFamily);

  // resolves the teamPlayerId that matches the profile's playerId (Player entity ID)
  const associatedTeamPlayerId = useMemo(() => {
    if (!associatedPlayerId) return null;
    const match = players.find(
      (p) =>
        p.id === associatedPlayerId ||
        (p.playerId && p.playerId.toLowerCase() === associatedPlayerId.toLowerCase())
    );
    return match?.id ?? null;
  }, [players, associatedPlayerId]);

  const [activeTab, setActiveTab] = useTabState(() => {
    const t = Number(squadSearchParams.get("tab"));
    return Number.isFinite(t) && t >= 0 ? t : 0;
  });

  function handleRatingCreated(rating: PlayerRating) {
    setLatestRatings((prev) => ({ ...prev, [rating.teamPlayerId]: rating }));
  }

  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  function clearRosterFilters() {
    setCategoryFilter(null);
    setSearchQuery("");
  }

  const filterCategories = useMemo(
    () =>
      CATEGORY_ORDER.filter((category) => players.some((p) => positionCategory(p.position) === category)).map(
        (category) => ({
          key: category,
          label: positionCategoryLabel(category),
          count: players.filter((p) => positionCategory(p.position) === category).length,
        })
      ),
    [players]
  );

  const visibleGroups = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const entries = players
      .map((player, idx) => ({
        player,
        key: player.id ?? `${player.name ?? ""}-${player.lastName ?? ""}-${idx}`,
      }))
      .filter(({ player }) => {
        const matchesCategory = categoryFilter === null || positionCategory(player.position) === categoryFilter;
        const searchable = `${player.name ?? ""} ${player.lastName ?? ""} ${player.alias ?? ""}`.toLowerCase();
        return matchesCategory && (!needle || searchable.includes(needle));
      });

    return CATEGORY_ORDER.map((category) => ({
      category,
      label: positionCategoryLabel(category),
      accent: categoryAccent(category),
      players: entries
        .filter(({ player }) => positionCategory(player.position) === category)
        .sort((a, b) => (a.player.dorsal ?? 999) - (b.player.dorsal ?? 999)),
    })).filter((group) => group.players.length > 0);
  }, [players, categoryFilter, searchQuery]);

  const photoByTeamPlayerId = useMemo(() => {
    const map: Record<string, string | null> = {};
    players.forEach((p, idx) => {
      if (!p.id) return;
      const key = p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`;
      map[p.id] = playerPhotos[key] ?? null;
    });
    return map;
  }, [players, playerPhotos]);

  const playerStatsMap = useMemo(() => {
    const map: Record<string, PlayerStatistics> = {};
    playerStats.forEach((s) => { map[s.teamPlayerId] = s; });
    return map;
  }, [playerStats]);

  const visiblePlayerStats = useMemo(() => {
    if (!isPlayerOrFamily) return playerStats;
    if (loadingProfile || !associatedTeamPlayerId) return [];
    return playerStats.filter((s) => s.teamPlayerId === associatedTeamPlayerId);
  }, [playerStats, isPlayerOrFamily, loadingProfile, associatedTeamPlayerId]);

  const ratingPlayers = useMemo(
    () =>
      players.map((p, idx) => {
        const key = p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`;
        return {
          teamPlayerId: p.id ?? `${p.name ?? ""}-${idx}`,
          displayName:
            ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias || "Jugador",
          alias: p.alias ?? null,
          position: p.position ?? null,
          dorsal: p.dorsal ?? null,
          photoSrc: playerPhotos[key] ?? null,
        };
      }),
    [players, playerPhotos]
  );

  useEffect(() => {
    let mounted = true;
    const created: string[] = [];

    async function loadPlayers() {
      if (!team) {
        setPlayers([]);
        setPlayerPhotos({});
        return;
      }
      setLoadingPlayers(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const seasonId = params.get("seasonId") ?? undefined;
        const list = await teamplayerService.getPlayersByTeam(
          team.id,
          seasonId
        );
        if (!mounted) return;
        setPlayers(list);

        const photos: Record<string, string | null> = {};
        await Promise.all(
          list.map(async (p, idx) => {
            const key = p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`;
            try {
              const photoField = p.urlPhoto ?? null;
              if (photoField) {
                const obj = await playerService.fetchPlayerPhoto(photoField);
                photos[key] = obj;
                if (obj) created.push(obj);
              } else photos[key] = null;
            } catch (e) {
              photos[key] = null;
            }
          })
        );
        if (!mounted) return;
        setPlayerPhotos(photos);
      } catch (e) {
        if (!mounted) return;
        setPlayers([]);
        setPlayerPhotos({});
      } finally {
        if (!mounted) return;
        setLoadingPlayers(false);
      }

      // Load latest ratings (best-effort, non-blocking)
      if (team && mounted) {
        setLoadingRatings(true);
        playerRatingService
          .getTeamLatestRatings(team.id)
          .then((data) => {
            if (!mounted) return;
            const map: Record<string, PlayerRating> = {};
            data.forEach((r) => { map[r.teamPlayerId] = r; });
            setLatestRatings(map);
          })
          .catch(() => {})
          .finally(() => { if (mounted) setLoadingRatings(false); });

        // Load league-only stats (best-effort, non-blocking)
        getTeamLeagueStats(team.id)
          .then((stats) => {
            if (!mounted) return;
            const map: Record<string, LeaguePlayerStats> = {};
            stats.forEach((s) => { map[s.teamPlayerId] = s; });
            setLeagueStats(map);
          })
          .catch(() => {});

        // Load per-player statistics + form status (best-effort, non-blocking)
        setLoadingStats(true);
        getTeamPlayerStatistics(team.id)
          .then((stats) => {
            if (!mounted) return;
            setPlayerStats(stats);
          })
          .catch(() => {})
          .finally(() => { if (mounted) setLoadingStats(false); });
      }
    }

    loadPlayers();

    return () => {
      mounted = false;
      created.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch (e) {}
      });
    };
  }, [team]);

  useEffect(() => {
    if (!isPlayerOrFamily) return;
    getMyProfile().then((profile) => {
      if (profile?.playerId) setAssociatedPlayerId(profile.playerId);
    }).finally(() => setLoadingProfile(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- roles are stable per session

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={"Plantilla"}
        subtitle={teamTitleNode ?? "Gestión de la plantilla de jugadores"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => goToTeamDashboard()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>

            {!isRestricted && (
              <Button
                onClick={() => {
                  const params = team ? `?teamId=${team.id}` : "";
                  const season = new URLSearchParams(window.location.search).get(
                    "seasonId"
                  );
                  navigate(
                    `/coach/squad/new${params}${
                      season ? `&seasonId=${season}` : ""
                    }`
                  );
                }}
                variant="contained"
                size="small"
                className={styles.addButton}
              >
                Añadir jugador
              </Button>
            )}
            {!isRestricted && (
              <Button
                onClick={() => {
                  const params = team ? `?teamId=${team.id}` : "";
                  const season = new URLSearchParams(window.location.search).get(
                    "seasonId"
                  );
                  navigate(
                    `/coach/squad/players-club${params}${
                      season ? `&seasonId=${season}` : ""
                    }`
                  );
                }}
                variant="outlined"
                size="small"
                className={styles.addButton}
              >
                Añadir jugadores del club
              </Button>
            )}
          </Stack>
        }
      >
        <Box className={styles.page}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            className={styles.tabs}
          >
            <Tab label="Plantilla" />
            {!isFan && <Tab label="Valoraciones" />}
            {!isFan && <Tab label="Estadísticas" />}
            {!isFan && !isPlayerOrFamily && <Tab label="Ranking" />}
            {!isFan && !isPlayerOrFamily && <Tab label="Alineación ideal" />}
          </Tabs>

          {activeTab === 0 && !loadingPlayers && players.length > 0 && (
            <>
              <SquadSummary players={players} />
              <SquadFilters
                categories={filterCategories}
                selected={categoryFilter}
                onSelect={setCategoryFilter}
                query={searchQuery}
                onQueryChange={setSearchQuery}
              />
            </>
          )}
          {activeTab === 0 && loadingPlayers && (
            <div className={styles.list}>
              <div className={styles.cardWrap}>Cargando...</div>
            </div>
          )}
          {activeTab === 0 && !loadingPlayers && players.length === 0 && (
            <div className={styles.list}>
              <div className={styles.cardWrap}>
                <EmptyState description={"No hay jugadores para mostrar."} />
              </div>
            </div>
          )}
          {activeTab === 0 && !loadingPlayers && players.length > 0 && visibleGroups.length === 0 && (
            <div className={styles.list}>
              <div className={styles.cardWrap}>
                <EmptyState description={"No hay jugadores para mostrar."} />
                <Button variant="outlined" size="small" onClick={clearRosterFilters}>
                  Quitar filtros
                </Button>
              </div>
            </div>
          )}
          {activeTab === 0 && !loadingPlayers && visibleGroups.length > 0 && (
            <div className={styles.positionGroups}>
              {visibleGroups.map(({ category, label, accent, players: group }) => {
                const seasonParam = new URLSearchParams(window.location.search).get("seasonId");
                return (
                  <section key={category} className={styles.positionGroup} aria-label={label}>
                    <div className={styles.positionGroupHeader}>
                      <span className={styles.positionGroupAccent} style={{ background: accent }} />
                      <h2 className={styles.positionGroupTitle}>{label}</h2>
                      <span className={styles.positionGroupCount}>{group.length}</span>
                    </div>
                    <div className={styles.cardGrid}>
                      {group.map(({ player: p, key }) => {
                        const displayName = ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
                        return (
                          <SquadPlayerCard
                            key={key}
                            displayName={displayName}
                            alias={p.alias}
                            photoSrc={playerPhotos[key] ?? null}
                            dorsal={p.dorsal ?? null}
                            position={p.position ?? null}
                            injured={p.isInjured === true}
                            onClearInjury={!isRestricted && p.isInjured && p.id ? async () => {
                              const ok = await dischargeActiveInjury(p.id);
                              if (ok) {
                                setPlayers((prev) =>
                                  prev.map((pl) =>
                                    pl.id === p.id ? { ...pl, isInjured: false } : pl
                                  )
                                );
                              }
                            } : undefined}
                            leagueStats={!isFan ? (leagueStats[p.id] ?? null) : null}
                            hideMinutes={isPlayerOrFamily}
                            readiness={playerStatsMap[p.id]?.readiness ?? null}
                            fatigue={playerStatsMap[p.id]?.fatigue ?? null}
                            formStatus={playerStatsMap[p.id]?.formStatus}
                            to={
                              isFan ? undefined :
                              isPlayerOrFamily && (loadingProfile || (associatedPlayerId && p.id !== associatedTeamPlayerId)) ? undefined :
                              p.id
                                ? `/coach/player/${p.id}${team ? `?teamId=${team.id}` : ""}${seasonParam ? `&seasonId=${seasonParam}` : ""}`
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {activeTab === 0 && !loadingPlayers && visibleGroups.length > 0 && (
            <div className={styles.formLegendRow}>
              <PlayerFormLegend />
            </div>
          )}

          {activeTab === 1 && team && (
            <SquadRatings
              teamId={team.id}
              players={
                isPlayerOrFamily && !loadingProfile && associatedTeamPlayerId
                  ? ratingPlayers
                      .filter((p) => p.teamPlayerId === associatedTeamPlayerId)
                      .map((p) => ({
                        ...p,
                        to: p.teamPlayerId
                          ? `/coach/player/${p.teamPlayerId}${team ? `?teamId=${team.id}` : ""}${new URLSearchParams(window.location.search).get("seasonId") ? `&seasonId=${new URLSearchParams(window.location.search).get("seasonId")}` : ""}`
                          : undefined,
                      }))
                  : isPlayerOrFamily && loadingProfile
                  ? []
                  : ratingPlayers
              }
              latestRatings={latestRatings}
              onRatingCreated={!isPlayerOrFamily ? handleRatingCreated : undefined}
              teamName={team.name}
              readOnly={isPlayerOrFamily}
            />
          )}

          {activeTab === 2 && !isFan && team && (
            <SquadStatistics
              players={visiblePlayerStats}
              loading={loadingStats}
              teamName={team.name}
              photoUrls={photoByTeamPlayerId}
              onOpenPlayer={(teamPlayerId) => navigate(`/coach/player/${teamPlayerId}`)}
            />
          )}

          {activeTab === 3 && !isFan && !isPlayerOrFamily && team && (
            <SquadRanking
              teamId={team.id}
              players={ratingPlayers}
              latestRatings={latestRatings}
              loading={loadingRatings}
              onRatingCreated={handleRatingCreated}
            />
          )}

          {activeTab === 4 && !isFan && !isPlayerOrFamily && team && (() => {
            const seasonId = new URLSearchParams(window.location.search).get("seasonId");
            const lineupPlayers = players.map((p, idx) => ({
              id: p.id ?? `${p.name ?? ""}-${idx}`,
              displayName: ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias || "Jugador",
              alias: p.alias ?? null,
              photoSrc: playerPhotos[p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`] ?? null,
              dorsal: p.dorsal ?? null,
              position: p.position ?? null,
              competitiveness: latestRatings[p.id]?.competitiveness ?? null,
              isInjured: p.isInjured === true,
            }));
            return (
              <IdealLineup
                players={lineupPlayers}
                teamId={team.id}
                seasonId={seasonId}
              />
            );
          })()}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
