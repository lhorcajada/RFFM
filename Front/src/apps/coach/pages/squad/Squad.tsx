import { Box, Button, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import { useMemo, useState as useTabState } from "react";
import SquadRatings from "./components/SquadRatings";
import SquadRanking from "./components/SquadRanking";
import PlayerCromo from "./components/PlayerCromo";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import DashboardCard from "../../../../shared/components/ui/DashboardCard/DashboardCard";
import PlayerCard from "../../components/PlayerCard/PlayerCard";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import teamplayerService from "../../services/teamplayerService";
import teamService from "../../services/teamService";
import playerService from "../../services/playerService";
import styles from "./Squad.module.css";
import defaultAvatar from "../../../../assets/avatar.svg";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const POSITION_ORDER = [
  "Portero",
  "Defensa",
  "Centrocampista",
  "Delantero",
];

function groupByPosition(players: any[]) {
  const groups: Record<string, any[]> = {};
  for (const p of players) {
    const key = p.position?.trim() || "Sin posición";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const ia = POSITION_ORDER.findIndex((pos) =>
      a.toLowerCase().includes(pos.toLowerCase())
    );
    const ib = POSITION_ORDER.findIndex((pos) =>
      b.toLowerCase().includes(pos.toLowerCase())
    );
    const ra = ia === -1 ? POSITION_ORDER.length : ia;
    const rb = ib === -1 ? POSITION_ORDER.length : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, "es");
  });
}

export default function Squad() {
  const navigate = useNavigate();
  const { team, teamTitleNode } = useTeamAndClub();
  const [players, setPlayers] = useState<any[]>([]);
  const [playerPhotos, setPlayerPhotos] = useState<
    Record<string, string | null>
  >({});
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [activeTab, setActiveTab] = useTabState(0);

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
            <Tab label="Valoraciones" />
            <Tab label="Ranking" />
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
          {activeTab === 0 &&
            !loadingPlayers &&
            playersByPosition.map(([position, group]) => (
              <div key={position} className={styles.positionGroup}>
                <div className={styles.positionHeader}>
                  <Typography variant="subtitle2" className={styles.positionTitle}>
                    {position}
                  </Typography>
                  <span className={styles.positionCount}>{group.length}</span>
                </div>
                <div className={styles.list}>
                  {group.map((p, idx) => {
                    const key =
                      p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`;
                    const displayName =
                      ((p.name ?? "") + " " + (p.lastName ?? "")).trim() ||
                      p.alias ||
                      "Jugador";
                    const seasonParam = new URLSearchParams(
                      window.location.search
                    ).get("seasonId");
                    return (
                      <PlayerCromo
                        key={key}
                        displayName={displayName}
                        photoSrc={playerPhotos[key] ?? null}
                        dorsal={p.dorsal ?? null}
                        position={p.position ?? null}
                        to={
                          p.id
                            ? `/coach/player/${p.id}${
                                team ? `?teamId=${team.id}` : ""
                              }${
                                seasonParam ? `&seasonId=${seasonParam}` : ""
                              }`
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}

          {activeTab === 1 && team && (
            <SquadRatings teamId={team.id} players={ratingPlayers} />
          )}

          {activeTab === 2 && team && (
            <SquadRanking teamId={team.id} players={ratingPlayers} />
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
