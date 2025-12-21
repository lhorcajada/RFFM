import { Box, Button, Stack } from "@mui/material";
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

export default function Squad() {
  const navigate = useNavigate();
  const { team, teamTitleNode } = useTeamAndClub();
  const [players, setPlayers] = useState<any[]>([]);
  const [playerPhotos, setPlayerPhotos] = useState<
    Record<string, string | null>
  >({});
  const [loadingPlayers, setLoadingPlayers] = useState(false);

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
        const list = await teamplayerService.getPlayersByTeam(team.id);
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
                navigate(`/coach/squad/new${params}`);
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
          <div className={styles.list}>
            {loadingPlayers && (
              <div className={styles.cardWrap}>Cargando...</div>
            )}
            {!loadingPlayers && players.length === 0 && (
              <div className={styles.cardWrap}>
                <EmptyState description={"No hay jugadores para mostrar."} />
              </div>
            )}
            {players.map((p, idx) => {
              const displayName =
                ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || "Jugador";
              const key = p.id ?? `${p.name ?? ""}-${p.lastName ?? ""}-${idx}`;
              return (
                <div key={key} className={styles.cardWrap}>
                  <PlayerCard
                    player={p}
                    photoSrc={playerPhotos[key] ?? defaultAvatar}
                    {...(p.id
                      ? {
                          to: `/coach/player/${p.id}${
                            team ? `?teamId=${team.id}` : ""
                          }`,
                        }
                      : {})}
                  />
                </div>
              );
            })}
          </div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
