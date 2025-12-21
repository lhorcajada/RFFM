import React, { useEffect, useState } from "react";
import DashboardCard from "../../../../shared/components/ui/DashboardCard/DashboardCard";
import { useParams, useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../components/ClubHeader/ClubHeader";
import styles from "./ClubTeams.module.css";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Paper } from "@mui/material";
import teamService, { TeamResponse } from "../../services/teamService";
import seasonService, { Season } from "../../services/seasonService";

export default function ClubTeams() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);
  const seasonId = qs.get("seasonId") ?? undefined;
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [teamPhotos, setTeamPhotos] = useState<Record<string, string | null>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await teamService.getTeams(id, seasonId);
        if (!mounted) return;
        setTeams(data);
        if (seasonId) {
          try {
            const seasons: Season[] = await seasonService.getSeasons();
            const s = seasons.find((x) => x.id === seasonId);
            if (s) setSeasonName(s.name ?? s.id);
            else setSeasonName(null);
          } catch (e) {
            setSeasonName(null);
          }
        } else {
          setSeasonName(null);
        }
        // load photos for teams
        const photos: Record<string, string | null> = {};
        await Promise.all(
          data.map(async (t) => {
            try {
              if (t.urlPhoto) {
                const obj = await teamService.fetchTeamPhoto(t.urlPhoto);
                photos[t.id] = obj;
              } else if (t.club?.shieldUrl) {
                const obj = await teamService.fetchTeamPhoto(t.club.shieldUrl);
                photos[t.id] = obj;
              } else photos[t.id] = null;
            } catch (e) {
              photos[t.id] = null;
            }
          })
        );
        if (!mounted) return;
        setTeamPhotos(photos);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Error cargando equipos");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
      // revoke object urls
      Object.values(teamPhotos).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [id]);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Equipos"
        subtitle={
          id ? (
            <>
              <ClubHeader clubId={id} />
              {seasonName && (
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  Temporada: {seasonName}
                </div>
              )}
            </>
          ) : (
            "-"
          )
        }
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/coach/clubs/dashboard/${id}`)}
              variant="outlined"
              size="small"
              className={styles.actionButton}
            >
              Volver
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(`/coach/clubs/${id}/teams/new`)}
              size="small"
            >
              Añadir equipo
            </Button>
          </>
        }
      >
        <Box className={styles.page}>
          <div className={styles.list}>
            {loading && <div className={styles.teamCard}>Cargando...</div>}
            {error && <div className={styles.teamCard}>{error}</div>}
            {!loading && !error && teams.length === 0 && (
              <div className={styles.teamCard}>
                <EmptyState description={"No hay equipos por mostrar."} />
              </div>
            )}
            {!loading &&
              !error &&
              teams.map((t) => (
                <div key={t.id} className={styles.cardWrap}>
                  <DashboardCard
                    title={t.name}
                    description={t.category?.name ?? t.league?.name}
                    icon={
                      <img
                        src={teamPhotos[t.id] ?? "/assets/logo.png"}
                        alt={t.name}
                        className={styles.teamIcon}
                      />
                    }
                    to={`/coach/dashboard?teamId=${t.id}${
                      seasonId ? `&seasonId=${seasonId}` : ""
                    }`}
                  />
                </div>
              ))}
          </div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
