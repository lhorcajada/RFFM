import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import DashboardCard from "../../../../shared/components/ui/DashboardCard/DashboardCard";
import ClubHeader from "../../components/ClubHeader/ClubHeader";
import styles from "./ClubTeams.module.css";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { Button, Avatar, IconButton, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsIcon from "@mui/icons-material/Groups";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
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

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Código copiado al portapapeles", severity: "success" },
        })
      );
    });
  }

  function formatTeamMeta(team: TeamResponse) {
    const categoryName = team.category?.name?.trim() || "Sin categoría";
    const leagueName = team.league?.name?.trim() || "Sin liga";
    return `Categoría: ${categoryName} · Liga: ${leagueName}`;
  }

  const groupedTeams = Object.entries(
    teams.reduce<Record<string, TeamResponse[]>>((groups, team) => {
      const categoryName = team.category?.name?.trim() || "Sin categoría";
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(team);
      return groups;
    }, {})
  )
    .map(([categoryName, categoryTeams]) => ({
      categoryName,
      teams: [...categoryTeams].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "es", {
          sensitivity: "base",
        })
      ),
    }))
    .sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName, "es", { sensitivity: "base" })
    );

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
            const seasons: Season[] = await seasonService.getSeasons(id);
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
              } else if (t.club?.emblemUrl) {
                const obj = await teamService.fetchTeamPhoto(t.club.emblemUrl);
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
                <div style={{ fontSize: 12, color: "var(--rffm-card-subtext)", marginTop: 4 }}>
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
              groupedTeams.map((group) => (
                <section key={group.categoryName} className={styles.categoryGroup}>
                  <h3 className={styles.categoryTitle}>{group.categoryName}</h3>
                  <div className={styles.teamGrid}>
                    {group.teams.map((t) => (
                      <div key={t.id} className={styles.cardWrap}>
                        <DashboardCard
                          className={styles.teamCard}
                          iconClassName={styles.teamCardIconWrap}
                          titleClassName={styles.teamTitle}
                          descriptionClassName={styles.teamMeta}
                          title={t.name}
                          description={formatTeamMeta(t)}
                          icon={
                            <div className={styles.teamPhoto}>
                              {teamPhotos[t.id] ? (
                                <img
                                  src={teamPhotos[t.id]!}
                                  alt={t.name}
                                  className={styles.teamIcon}
                                />
                              ) : (
                                <Avatar
                                  className={styles.teamIcon}
                                  sx={{
                                    bgcolor: "var(--rffm-primary)",
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: "inherit",
                                  }}
                                >
                                  <GroupsIcon
                                    sx={{
                                      fontSize: "var(--rffm-club-teams-fallback-icon-size)",
                                      color: "var(--rffm-card-text)",
                                    }}
                                  />
                                </Avatar>
                              )}
                            </div>
                          }
                          to={`/coach/dashboard?teamId=${t.id}${
                            seasonId ? `&seasonId=${seasonId}` : ""
                          }`}
                          footer={
                            t.joinCode ? (
                              <div className={styles.codeRow}>
                                <Typography variant="caption" className={styles.codeText}>
                                  <span className={styles.codeLabel}>CODIGO:&nbsp;</span>
                                  <strong className={styles.codeValue}>{t.joinCode}</strong>
                                </Typography>
                                <Tooltip title="Copiar código">
                                  <IconButton
                                    className={styles.copyBtn}
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleCopyCode(t.joinCode!);
                                    }}
                                    aria-label="Copiar código de equipo"
                                  >
                                    <ContentCopyIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              </div>
                            ) : null
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
