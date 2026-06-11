import { Box, Button, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import SquadRatings from "./components/SquadRatings";
import SquadRanking from "./components/SquadRanking";
import IdealLineup from "./components/IdealLineup";
import PlayerCromo from "./components/PlayerCromo";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { coachAuthService } from "../../services/authService";
import { getMyProfile } from "../../services/coachApi";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import teamplayerService from "../../services/teamplayerService";
import { dischargeActiveInjury } from "../../services/teamplayerService";
import playerService from "../../services/playerService";
import playerRatingService from "../../services/playerRatingService";
import { getSeasonPlayerStats } from "../../services/liveMatchService";
import type { SeasonPlayerStats } from "../convocations/components/simulation/liveMatch.types";
import type { PlayerRating } from "../../types/playerRating";
import styles from "./Squad.module.css";

const useTabState = useState;

function positionCategory(position: string): number {
  const p = position.toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (
    p.includes("defensa") || p.includes("central") || p.includes("lateral") ||
    p.includes("libero") || p.includes("stopper")
  ) return 1;
  if (
    p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") ||
    p.includes("interior") || p.includes("volante")
  ) return 2;
  if (
    p.includes("delantero") || p.includes("extremo") || p.includes("punta") ||
    p.includes("ariete") || p.includes("winger")
  ) return 3;
  return 4;
}

function positionAccent(position: string): string {
  const cat = positionCategory(position);
  if (cat === 0) return "#f59e0b";
  if (cat === 1) return "#3b82f6";
  if (cat === 2) return "#10b981";
  if (cat === 3) return "#ef4444";
  return "#6b7280";
}

function groupByPosition(players: any[]) {
  const groups: Record<string, any[]> = {};
  for (const p of players) {
    const key = p.position?.trim() || "Sin posición";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const ca = positionCategory(a);
    const cb = positionCategory(b);
    if (ca !== cb) return ca - cb;
    return a.localeCompare(b, "es");
  });
}

export default function Squad() {
  const navigate = useNavigate();
  const [squadSearchParams] = useSearchParams();
  const { team, teamTitleNode } = useTeamAndClub();
  const [players, setPlayers] = useState<any[]>([]);
  const [playerPhotos, setPlayerPhotos] = useState<Record<string, string | null>>({});
  const [latestRatings, setLatestRatings] = useState<Record<string, PlayerRating>>({});
  const [seasonStats, setSeasonStats] = useState<Record<string, SeasonPlayerStats>>({});
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
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

  const playersByPosition = useMemo(() => groupByPosition(players), [players]);

  const ratingPlayers = useMemo(
    () =>
      players.map((p, idx) => {
        const key = p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`;
        return {
          teamPlayerId: p.id ?? `${p.name ?? ""}-${idx}`,
          displayName:
            ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias || "Jugador",
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

        // Load season stats (best-effort, non-blocking)
        getSeasonPlayerStats(team.id)
          .then((stats) => {
            if (!mounted) return;
            const map: Record<string, SeasonPlayerStats> = {};
            stats.forEach((s) => { map[s.teamPlayerId] = s; });
            setSeasonStats(map);
          })
          .catch(() => {});
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
              onClick={() => navigate("/coach/dashboard")}
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
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Plantilla" />
            {!isFan && <Tab label="Valoraciones" />}
            {!isFan && !isPlayerOrFamily && <Tab label="Ranking" />}
            {!isFan && !isPlayerOrFamily && <Tab label="Alineación ideal" />}
          </Tabs>

          {activeTab === 0 && !loadingPlayers && players.length > 0 && (
            <div className={styles.totalCount}>
              <Chip
                label={`${players.length} jugador${players.length !== 1 ? "es" : ""}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            </div>
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
          {activeTab === 0 && !loadingPlayers && playersByPosition.length > 0 && (
            <div className={styles.positionsDashboard}>
              {playersByPosition.map(([position, group]) => {
                const accent = positionAccent(position);
                const seasonParam = new URLSearchParams(window.location.search).get("seasonId");
                return (
                  <div key={position} className={styles.positionPanel}>
                    <div className={styles.positionPanelAccent} style={{ background: accent }} />
                    <div className={styles.positionPanelHeader}>
                      <span className={styles.positionPanelTitle}>{position}</span>
                      <span className={styles.positionPanelCount}>{group.length}</span>
                    </div>
                    <div className={styles.positionPanelGrid}>
                      {group.map((p, idx) => {
                        const key = p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`;
                        const displayName = ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias || "Jugador";
                        return (
                          <PlayerCromo
                            key={key}
                            displayName={displayName}
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
                            rating={(() => {
                              if (isFan) return null;
                              // Only restrict once we know the associated player; while loading, show nothing to avoid flicker
                              if (isPlayerOrFamily && loadingProfile) return null;
                              if (isPlayerOrFamily && associatedPlayerId && p.id !== associatedTeamPlayerId) return null;
                              const r = latestRatings[p.id];
                              return r
                                ? { technical: r.technical, tactical: r.tactical, physical: r.physical, competitiveness: r.competitiveness }
                                : null;
                            })()}
                            seasonStats={!isRestricted || (!loadingProfile && p.id === associatedTeamPlayerId) ? (seasonStats[p.id] ?? null) : null}
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
                  </div>
                );
              })}
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

          {activeTab === 2 && !isFan && !isPlayerOrFamily && team && (
            <SquadRanking
              teamId={team.id}
              players={ratingPlayers}
              latestRatings={latestRatings}
              loading={loadingRatings}
              onRatingCreated={handleRatingCreated}
            />
          )}

          {activeTab === 3 && !isFan && !isPlayerOrFamily && team && (() => {
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
