import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";
import { Box, TextField, Button } from "@mui/material";
import styles from "../ClubTeams.module.css";
import teamService from "../../../services/teamService";
import CategorySelect from "../../../components/CategorySelect/CategorySelect";
import LeagueSelect from "../../../components/LeagueSelect/LeagueSelect";
import FileImagePicker from "../../../../../shared/components/ui/FileImagePicker/FileImagePicker";

export default function CreateTeam() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Categories and leagues are loaded from the API via CategorySelect/LeagueSelect

  const handleSubmit = async () => {
    if (!id) return;
    if (!name || !categoryId) return;
    setSaving(true);
    try {
      await teamService.createTeam(id, {
        name,
        categoryId: categoryId!,
        leagueId,
        photo,
      });
      navigate(`/coach/clubs/${id}/teams`);
    } catch (e) {
      // TODO: show error
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Añadir equipo"
        subtitle={id ? <ClubHeader clubId={id} /> : "-"}
        actionBar={
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(-1)}
            >
              Volver
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </>
        }
      >
        <Box className={styles.page}>
          <TextField
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            margin="normal"
          />

          <CategorySelect
            value={categoryId}
            onChange={(c) => setCategoryId(c?.id ?? null)}
          />

          <LeagueSelect
            categoryId={categoryId}
            value={leagueId}
            onChange={(l) => setLeagueId(l?.id ?? null)}
          />

          <div style={{ marginTop: 12 }}>
            <FileImagePicker
              id="team-photo"
              label="Seleccionar foto del equipo"
              accept="image/png, image/jpeg"
              file={photo}
              onChange={(f) => setPhoto(f)}
            />
          </div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
