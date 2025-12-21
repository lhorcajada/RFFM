import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  CircularProgress,
} from "@mui/material";
import CoachDialog from "../../../components/CoachDialog/CoachDialog";
import styles from "./CreateClub.module.css";
import clubService from "../../../services/clubService";
import MembershipRole from "../../../types/MembershipRole";
import countryService from "../../../services/countryService";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FileImagePicker from "../../../../../shared/components/ui/FileImagePicker/FileImagePicker";

export default function CreateClub() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [countries, setCountries] = useState<
    Array<{ id: number; name: string; code: string }>
  >([]);
  const [emblemFile, setEmblemFile] = useState<File | null>(null);
  const [emblemPreview, setEmblemPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // load countries
    let mounted = true;
    countryService.getCountries().then((res: any) => {
      if (!mounted) return;
      setCountries(res || []);
    });
    return () => {
      mounted = false;
      if (emblemPreview) URL.revokeObjectURL(emblemPreview);
    };
  }, []);

  useEffect(() => {
    if (!emblemFile) {
      setEmblemPreview(null);
      return;
    }
    const url = URL.createObjectURL(emblemFile);
    setEmblemPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [emblemFile]);

  function validate() {
    const e: Record<string, string> = {};
    if (!name || name.trim().length === 0) e.name = "El nombre es requerido.";
    if (name.length > 200)
      e.name = "El nombre no puede exceder 200 caracteres.";
    if (!countryCode || countryCode.trim().length === 0)
      e.countryCode = "Selecciona un país.";
    if (emblemFile) {
      if (!["image/png", "image/jpeg"].includes(emblemFile.type))
        e.emblem = "Formato inválido. Usa PNG o JPG.";
      if (emblemFile.size > 2 * 1024 * 1024)
        e.emblem = "El archivo debe ser menor a 2MB.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Use the MembershipRole enum for role id
      const roleId = MembershipRole.Coach;
      await clubService.createClubMultipart({
        name: name.trim(),
        countryCode: countryCode,
        roleId,
        emblem: emblemFile || undefined,
      });

      // show success dialog and then navigate back
      setSuccessOpen(true);
      // let the dialog auto-close and navigate after 1.2s
      setTimeout(() => {
        setSuccessOpen(false);
        navigate("/coach/clubs");
      }, 1200);
    } catch (err) {
      // TODO: show nice error dialog
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const [successOpen, setSuccessOpen] = useState(false);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Crear club"
        subtitle="Añade un nuevo club"
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/clubs")}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            <Button
              type="submit"
              form="create-club-form"
              variant="contained"
              size="small"
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : "Guardar"}
            </Button>
          </>
        }
      >
        <div className={styles.page}>
          <form
            id="create-club-form"
            onSubmit={handleSubmit}
            className={styles.form}
          >
            <TextField
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel id="country-label">País</InputLabel>
              <Select
                labelId="country-label"
                value={countryCode}
                label="País"
                onChange={(e) => setCountryCode(String(e.target.value))}
                error={!!errors.countryCode}
              >
                {countries.map((c) => (
                  <MenuItem key={c.id} value={c.code}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.countryCode && (
                <div className={styles.error}>{errors.countryCode}</div>
              )}
            </FormControl>

            <div>
              <FileImagePicker
                id="emblem"
                label="Seleccionar escudo"
                accept="image/png, image/jpeg"
                file={emblemFile}
                onChange={(f) => setEmblemFile(f)}
              />
              {errors.emblem && (
                <div className={styles.error}>{errors.emblem}</div>
              )}
            </div>
          </form>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
