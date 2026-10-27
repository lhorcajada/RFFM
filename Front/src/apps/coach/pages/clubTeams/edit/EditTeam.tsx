import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";
import { Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import styles from "../ClubTeams.module.css";
import formStyles from "../TeamForm.module.css";
import teamService from "../../../services/teamService";
import rffmCompetitionService from "../../../services/rffmCompetitionService";
import CategorySelect from "../../../components/CategorySelect/CategorySelect";
import LeagueSelect from "../../../components/LeagueSelect/LeagueSelect";
import RffmCompetitionSelect from "../../../components/RffmCompetitionSelect/RffmCompetitionSelect";
import RffmTeamSelect from "../../../components/RffmTeamSelect/RffmTeamSelect";
import FileImagePicker from "../../../../../shared/components/ui/FileImagePicker/FileImagePicker";

const STANDING_SPOTS_MAX = 30;

function parseSpots(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= STANDING_SPOTS_MAX ? value : null;
}

export default function EditTeam() {
  const navigate = useNavigate();
  const { id, teamId } = useParams();
  const { search } = useLocation();
  const seasonId = new URLSearchParams(search).get("seasonId") ?? undefined;

  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<number | null>(null);
  const [leagueId, setLeagueId] = React.useState<number | null>(null);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = React.useState<string | null>(null);
  const [existingPhotoPreview, setExistingPhotoPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Competición/grupo REALES de RFFM (catálogo scrapeado de la federación), distintos del
  // catálogo local de Liga/Grupo gestionado arriba por LeagueSelect.
  const [rffmCompetitionId, setRffmCompetitionId] = React.useState<number | null>(null);
  const [rffmGroupId, setRffmGroupId] = React.useState<number | null>(null);
  const [rffmTeamCode, setRffmTeamCode] = React.useState<string | null>(null);
  const [promotionSpots, setPromotionSpots] = React.useState<number | null>(null);
  const [playoffSpots, setPlayoffSpots] = React.useState<number | null>(null);
  const [relegationSpots, setRelegationSpots] = React.useState<number | null>(null);
  const [savingRffmCompetition, setSavingRffmCompetition] = React.useState(false);
  const standingSpotFields = [
    { label: "Plazas de ascenso", value: promotionSpots, setValue: setPromotionSpots },
    { label: "Plazas de promoción", value: playoffSpots, setValue: setPlayoffSpots },
    { label: "Plazas de descenso", value: relegationSpots, setValue: setRelegationSpots },
  ];
  const [rffmCompetitionError, setRffmCompetitionError] = React.useState<string | null>(null);

  const teamsListPath = `/coach/clubs/${id}/teams${
    seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : ""
  }`;

  React.useEffect(() => {
    let mounted = true;

    async function loadTeam() {
      if (!id || !teamId) return;
      setLoading(true);
      setError(null);

      try {
        const team = await teamService.getTeamById(teamId);
        if (!mounted) return;

        if (!team) {
          setError("No se encontró el equipo.");
          return;
        }

        setName(team.name ?? "");
        setCategoryId(team.category?.id ?? null);
        setLeagueId(team.league?.id ?? null);
        setExistingPhotoUrl(team.urlPhoto ?? null);
        setRffmCompetitionId(team.rffmCompetitionId ?? null);
        setRffmGroupId(team.rffmGroupId ?? null);
        setRffmTeamCode(team.rffmTeamCode ?? null);
        setPromotionSpots(team.promotionSpots ?? null);
        setPlayoffSpots(team.playoffSpots ?? null);
        setRelegationSpots(team.relegationSpots ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "No se pudo cargar el equipo");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTeam();

    return () => {
      mounted = false;
    };
  }, [id, teamId]);

  React.useEffect(() => {
    let mounted = true;

    async function loadExistingPhotoPreview(url: string) {
      const objectUrl = await teamService.fetchTeamPhoto(url);
      if (!mounted) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      setExistingPhotoPreview(objectUrl);
    }

    if (!existingPhotoUrl) {
      setExistingPhotoPreview(null);
      return () => {
        mounted = false;
      };
    }

    void loadExistingPhotoPreview(existingPhotoUrl);

    return () => {
      mounted = false;
      setExistingPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [existingPhotoUrl]);

  const handleSubmit = async () => {
    if (!id || !teamId) return;

    const trimmedName = name.trim();
    if (!trimmedName || !categoryId) {
      setError("Debes indicar nombre y categoría.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let nextPhotoUrl = existingPhotoUrl;

      if (photo) {
        const uploadResult = await teamService.uploadTeamPhoto(photo);
        nextPhotoUrl = uploadResult?.url ?? uploadResult?.Url ?? null;
      }

      await teamService.updateTeam(teamId, {
        name: trimmedName,
        categoryId,
        leagueId,
        clubId: id,
        seasonId: seasonId ?? null,
        urlPhoto: nextPhotoUrl ?? null,
      });

      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Equipo actualizado correctamente", severity: "success" },
        })
      );

      navigate(teamsListPath);
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        "No se pudo actualizar el equipo";

      setError(message);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message, severity: "error" },
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRffmCompetition = async () => {
    if (!teamId) return;

    setSavingRffmCompetition(true);
    setRffmCompetitionError(null);

    try {
      await rffmCompetitionService.updateTeamCompetition(teamId, {
        competitionId: rffmCompetitionId,
        groupId: rffmGroupId,
        teamCode: rffmTeamCode,
        promotionSpots,
        playoffSpots,
        relegationSpots,
      });

      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "Competición RFFM guardada correctamente", severity: "success" },
        })
      );
    } catch (e: any) {
      const message =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        "No se pudo guardar la competición RFFM";

      setRffmCompetitionError(message);
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message, severity: "error" },
        })
      );
    } finally {
      setSavingRffmCompetition(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Editar equipo"
        subtitle={id ? <ClubHeader clubId={id} /> : "-"}
        actionBar={
          <Button variant="outlined" size="small" onClick={() => navigate(teamsListPath)}>
            Volver
          </Button>
        }
      >
        <Box className={`${styles.page} ${formStyles.page}`}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <>
              {error && <div className={formStyles.errorBox}>{error}</div>}

              <div className={formStyles.sections}>
                <section className={formStyles.section}>
                  <h2 id="team-data-title" className={formStyles.sectionTitle}>
                    Datos del equipo
                  </h2>

                  <TextField
                    label="Nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                  />

                  <CategorySelect value={categoryId} onChange={(c) => setCategoryId(c?.id ?? null)} />

                  <LeagueSelect
                    categoryId={categoryId}
                    value={leagueId}
                    onChange={(l) => setLeagueId(l?.id ?? null)}
                  />

                  <div className={formStyles.photoBox}>
                    {!photo && existingPhotoPreview && (
                      <img
                        src={existingPhotoPreview}
                        alt="Foto actual del equipo"
                        className={formStyles.photoPreview}
                      />
                    )}
                    <FileImagePicker
                      id="team-photo"
                      label="Seleccionar nueva foto del equipo"
                      accept="image/png, image/jpeg"
                      file={photo}
                      onChange={(f) => setPhoto(f)}
                    />
                  </div>
                </section>

                <section className={formStyles.section}>
                  <div>
                    <h2 id="team-rffm-title" className={formStyles.sectionTitle}>
                      Competición RFFM
                    </h2>
                    <p className={formStyles.sectionHint}>
                      Catálogo real de la federación. Se guarda por separado.
                    </p>
                  </div>

                  <RffmCompetitionSelect
                    competitionId={rffmCompetitionId}
                    groupId={rffmGroupId}
                    onChange={(v) => {
                      const leagueChanged = v.competitionId !== rffmCompetitionId || v.groupId !== rffmGroupId;
                      if (leagueChanged) setRffmTeamCode(null);
                      setRffmCompetitionId(v.competitionId);
                      setRffmGroupId(v.groupId);
                    }}
                  />
                  <RffmTeamSelect
                    competitionId={rffmCompetitionId}
                    groupId={rffmGroupId}
                    teamCode={rffmTeamCode}
                    onChange={setRffmTeamCode}
                  />

                  <div className={formStyles.spotsBox}>
                    <p className={formStyles.sectionHint}>
                      Plazas de la clasificación según las Bases de ascensos y descensos de la categoría.
                    </p>
                    <div className={formStyles.spotsRow}>
                      {standingSpotFields.map((field) => (
                        <TextField
                          key={field.label}
                          label={field.label}
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) => field.setValue(parseSpots(e.target.value))}
                          inputProps={{ min: 0, max: STANDING_SPOTS_MAX }}
                        />
                      ))}
                    </div>
                  </div>

                  {rffmCompetitionError && <div className={formStyles.errorBox}>{rffmCompetitionError}</div>}
                  <div className={formStyles.sectionActions}>
                    <Button
                      variant="outlined"
                      onClick={handleSaveRffmCompetition}
                      disabled={savingRffmCompetition}
                    >
                      {savingRffmCompetition ? "Guardando..." : "Guardar competición RFFM"}
                    </Button>
                  </div>
                </section>
              </div>

              <div className={formStyles.actionBar}>
                <Button onClick={() => navigate(teamsListPath)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="contained" onClick={handleSubmit} disabled={saving || loading}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
