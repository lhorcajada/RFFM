import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import clubService from "../../../../../services/clubService";
import countryService from "../../../../../services/countryService";
import MembershipRole from "../../../../../types/MembershipRole";
import FileImagePicker from "../../../../../../../shared/components/ui/FileImagePicker/FileImagePicker";
import { mapApiErrorToMessage } from "../../../../../../../shared/utils/errorMessages";
import styles from "./SeasonClubField.module.css";

const CREATE_CLUB_OPTION = "__create__";

interface SeasonClubFieldProps {
  value: string;
  onChange: (clubId: string) => void;
  disabled?: boolean;
}

type ClubOption = {
  id: string;
  name: string;
};

type CountryOption = {
  id: number;
  name: string;
  code?: string;
};

export default function SeasonClubField({ value, onChange, disabled }: SeasonClubFieldProps) {
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newClubCountryCode, setNewClubCountryCode] = useState("");
  const [newClubEmblemFile, setNewClubEmblemFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadClubs = async () => {
    setLoading(true);
    try {
      const clubsResp = await clubService.getUserClubs();
      setClubs((clubsResp ?? []).map((club) => ({ id: club.clubId, name: club.clubName })));
    } catch {
      setClubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClubs();
  }, []);

  const loadCountries = async () => {
    setCountriesLoading(true);
    try {
      const countriesResp = await countryService.getCountries();
      setCountries((countriesResp ?? []).filter((country) => !!country.code));
    } catch {
      setCountries([]);
    } finally {
      setCountriesLoading(false);
    }
  };

  const resetCreateForm = () => {
    setNewClubName("");
    setNewClubCountryCode("");
    setNewClubEmblemFile(null);
    setCreateError(null);
  };

  const openCreateDialog = () => {
    setCreateDialogOpen(true);
    resetCreateForm();
    if (!countries.length && !countriesLoading) {
      void loadCountries();
    }
  };

  const closeCreateDialog = () => {
    if (createLoading) return;
    setCreateDialogOpen(false);
  };

  const handleSelectChange = (nextValue: string) => {
    if (nextValue === CREATE_CLUB_OPTION) {
      openCreateDialog();
      return;
    }
    onChange(nextValue);
  };

  const handleCreateClub = async () => {
    setCreateError(null);

    if (!newClubName.trim() || !newClubCountryCode.trim()) {
      setCreateError(mapApiErrorToMessage({ response: { data: { code: "ValidationFailed" } } }));
      return;
    }

    setCreateLoading(true);
    try {
      const created = await clubService.createClubMultipart({
        name: newClubName.trim(),
        countryCode: newClubCountryCode,
        roleId: MembershipRole.Coach,
        emblem: newClubEmblemFile ?? undefined,
      });

      const refreshedClubs = await clubService.getUserClubs();
      const mappedClubs = (refreshedClubs ?? []).map((club) => ({ id: club.clubId, name: club.clubName }));
      setClubs(mappedClubs);

      const newClubId: string =
        created?.id ??
        mappedClubs.find((club) => club.name === newClubName.trim())?.id ??
        "";

      setCreateDialogOpen(false);
      if (newClubId) {
        onChange(newClubId);
      }
    } catch (error) {
      setCreateError(mapApiErrorToMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <FormControl fullWidth size="small" disabled={disabled || loading}>
        <InputLabel id="season-club-field-label">Club</InputLabel>
        <Select
          labelId="season-club-field-label"
          label="Club"
          value={value}
          onChange={(event) => handleSelectChange(String(event.target.value))}
          displayEmpty
          renderValue={(selected) => {
            const selectedClub = clubs.find((club) => club.id === selected);
            return selectedClub?.name ?? "Selecciona un club";
          }}
        >
          {value && !clubs.some((club) => club.id === value) && (
            <MenuItem value={value} style={{ display: "none" }}>
              {value}
            </MenuItem>
          )}
          {clubs.map((club) => (
            <MenuItem key={club.id} value={club.id}>
              {club.name}
            </MenuItem>
          ))}
          <MenuItem value={CREATE_CLUB_OPTION}>+ Crear club nuevo</MenuItem>
        </Select>
      </FormControl>

      {!loading && clubs.length === 0 && (
        <div className={styles.emptyState}>
          <Typography variant="body2" className={styles.helperText}>
            No tienes clubes todavía. Crea el primero para poder crear una temporada.
          </Typography>
          <Button size="small" variant="outlined" onClick={openCreateDialog} disabled={disabled}>
            Crear club
          </Button>
        </div>
      )}

      <Dialog open={createDialogOpen} onClose={closeCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Crear club</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createError && <div className={styles.errorBox}>{createError}</div>}

            <TextField
              label="Nombre"
              value={newClubName}
              onChange={(event) => setNewClubName(event.target.value)}
              fullWidth
              inputProps={{ maxLength: 200 }}
            />

            <FormControl fullWidth>
              <InputLabel id="season-club-field-country">País</InputLabel>
              <Select
                labelId="season-club-field-country"
                label="País"
                value={newClubCountryCode}
                onChange={(event) => setNewClubCountryCode(String(event.target.value))}
                disabled={countriesLoading}
              >
                {countries.map((country) => (
                  <MenuItem key={country.id} value={country.code ?? ""}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FileImagePicker
              id="season-club-field-emblem"
              label="Seleccionar escudo"
              accept="image/png, image/jpeg"
              file={newClubEmblemFile}
              onChange={(file) => setNewClubEmblemFile(file)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog} disabled={createLoading}>
            Cancelar
          </Button>
          <Button onClick={handleCreateClub} variant="contained" disabled={createLoading}>
            {createLoading ? <CircularProgress size={18} /> : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
