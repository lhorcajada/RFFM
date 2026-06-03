import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import DashboardCard from "../../../../shared/components/ui/DashboardCard/DashboardCard";
import ClubHeader from "../../components/ClubHeader/ClubHeader";
import styles from "./ClubTeams.module.css";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import {
  Button,
  Avatar,
  IconButton,
  Tooltip,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupsIcon from "@mui/icons-material/Groups";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
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
  const [deleteTarget, setDeleteTarget] = useState<TeamResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>("all");

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

  const loadTeams = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teamService.getTeams(id, seasonId);
      setTeams(data);

      const availableCategories = Array.from(
        new Set(data.map((team) => team.category?.name?.trim() || "Sin categoría"))
      );
      const availableLeagues = Array.from(
        new Set(data.map((team) => team.league?.name?.trim() || "Sin liga"))
      );
      if (
        selectedCategoryFilter !== "all" &&
        !availableCategories.includes(selectedCategoryFilter)
      ) {
        setSelectedCategoryFilter("all");
      }
      if (selectedLeagueFilter !== "all" && !availableLeagues.includes(selectedLeagueFilter)) {
        setSelectedLeagueFilter("all");
      }

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
      setTeamPhotos((previousPhotos) => {
        Object.values(previousPhotos).forEach((u) => {
          if (u) URL.revokeObjectURL(u);
        });
        return photos;
      });
    } catch (e: any) {
      setError(e?.message || "Error cargando equipos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget?.id) return;

    setDeleteLoading(true);
    setError(null);
    try {
      await teamService.deleteTeam(deleteTarget.id);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Equipo eliminado correctamente", severity: "success" },
        })
      );
      setDeleteTarget(null);
      await loadTeams();
    } catch (e: any) {
      const backendMessage =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        "No se pudo eliminar el equipo";
      setError(backendMessage);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: backendMessage, severity: "error" },
        })
      );
    } finally {
      setDeleteLoading(false);
    }
  };

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

  const categoryFilterOptions = groupedTeams.map((group) => group.categoryName);
  const leagueFilterOptions = Array.from(
    new Set(teams.map((team) => team.league?.name?.trim() || "Sin liga"))
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const visibleGroupedTeams =
    selectedCategoryFilter === "all" && selectedLeagueFilter === "all"
      ? groupedTeams
      : groupedTeams
          .map((group) => ({
            ...group,
            teams: group.teams.filter((team) => {
              const teamLeague = team.league?.name?.trim() || "Sin liga";
              const matchesCategory =
                selectedCategoryFilter === "all" || group.categoryName === selectedCategoryFilter;
              const matchesLeague =
                selectedLeagueFilter === "all" || teamLeague === selectedLeagueFilter;
              return matchesCategory && matchesLeague;
            }),
          }))
          .filter((group) => group.teams.length > 0);

  useEffect(() => {
    if (!id) return;

    void (async () => {
      await loadTeams();
    })();

    return () => {
      // revoke object urls
      Object.values(teamPhotos).forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
  }, [id, seasonId]);

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
          <div className={styles.filterRow}>
            <FormControl size="small" className={styles.filterControl}>
              <InputLabel id="club-teams-category-filter-label">Categoría</InputLabel>
              <Select
                labelId="club-teams-category-filter-label"
                value={selectedCategoryFilter}
                label="Categoría"
                onChange={(event) => setSelectedCategoryFilter(event.target.value)}
              >
                <MenuItem value="all">Todas</MenuItem>
                {categoryFilterOptions.map((categoryName) => (
                  <MenuItem key={categoryName} value={categoryName}>
                    {categoryName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" className={styles.filterControl}>
              <InputLabel id="club-teams-league-filter-label">Liga</InputLabel>
              <Select
                labelId="club-teams-league-filter-label"
                value={selectedLeagueFilter}
                label="Liga"
                onChange={(event) => setSelectedLeagueFilter(event.target.value)}
              >
                <MenuItem value="all">Todas</MenuItem>
                {leagueFilterOptions.map((leagueName) => (
                  <MenuItem key={leagueName} value={leagueName}>
                    {leagueName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <div className={styles.list}>
            {loading && <div className={styles.teamCard}>Cargando...</div>}
            {error && <div className={styles.teamCard}>{error}</div>}
            {!loading && !error && teams.length === 0 && (
              <div className={styles.teamCard}>
                <EmptyState description={"No hay equipos por mostrar."} />
              </div>
            )}
            {!loading && !error && teams.length > 0 && visibleGroupedTeams.length === 0 && (
              <div className={styles.teamCard}>
                <EmptyState description={"No hay equipos con los filtros seleccionados."} />
              </div>
            )}
            {!loading &&
              !error &&
              visibleGroupedTeams.map((group) => (
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
                            <div className={styles.footerRow}>
                              {t.joinCode ? (
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
                              ) : (
                                <span className={styles.codePlaceholder} />
                              )}

                              <Tooltip title="Eliminar equipo">
                                <span>
                                  <IconButton
                                    className={styles.deleteBtn}
                                    size="small"
                                    disabled={deleteLoading}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setDeleteTarget(t);
                                    }}
                                    aria-label="Eliminar equipo"
                                  >
                                    <DeleteOutlineIcon fontSize="inherit" />
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Tooltip title="Editar equipo">
                                <span>
                                  <IconButton
                                    className={styles.editBtn}
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      navigate(
                                        `/coach/clubs/${id}/teams/${t.id}/edit${
                                          seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : ""
                                        }`
                                      );
                                    }}
                                    aria-label="Editar equipo"
                                  >
                                    <EditOutlinedIcon fontSize="inherit" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </div>
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

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar equipo</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Quieres eliminar {deleteTarget?.name ?? "este equipo"}? Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirmed} variant="contained" color="error" disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={16} color="inherit" /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </BaseLayout>
  );
}
