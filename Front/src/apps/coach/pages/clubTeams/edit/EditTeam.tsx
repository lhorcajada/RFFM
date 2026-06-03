import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";
import { Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import styles from "../ClubTeams.module.css";
import teamService from "../../../services/teamService";
import CategorySelect from "../../../components/CategorySelect/CategorySelect";
import LeagueSelect from "../../../components/LeagueSelect/LeagueSelect";
import FileImagePicker from "../../../../../shared/components/ui/FileImagePicker/FileImagePicker";

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

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Editar equipo"
        subtitle={id ? <ClubHeader clubId={id} /> : "-"}
        actionBar={
          <>
            <Button variant="outlined" size="small" onClick={() => navigate(teamsListPath)}>
              Volver
            </Button>
            <Button variant="contained" size="small" onClick={handleSubmit} disabled={saving || loading}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </>
        }
      >
        <Box className={styles.page}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <>
              {error && (
                <Typography color="error" variant="body2" sx={{ mb: 1 }}>
                  {error}
                </Typography>
              )}

              <TextField
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                margin="normal"
              />

              <CategorySelect value={categoryId} onChange={(c) => setCategoryId(c?.id ?? null)} />

              <LeagueSelect
                categoryId={categoryId}
                value={leagueId}
                onChange={(l) => setLeagueId(l?.id ?? null)}
              />

              <Box mt={1.5} mb={1}>
                <FileImagePicker
                  id="team-photo"
                  label="Seleccionar nueva foto del equipo"
                  accept="image/png, image/jpeg"
                  file={photo}
                  onChange={(f) => setPhoto(f)}
                />
              </Box>

              {!photo && existingPhotoPreview && (
                <Box mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Foto actual
                  </Typography>
                  <Box mt={0.5}>
                    <img
                      src={existingPhotoPreview}
                      alt="Foto actual del equipo"
                      style={{ width: 72, height: 90, objectFit: "cover", borderRadius: 8 }}
                    />
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
