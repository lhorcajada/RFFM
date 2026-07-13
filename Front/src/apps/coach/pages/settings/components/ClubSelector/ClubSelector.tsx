import React, { useEffect, useRef, useState } from "react";
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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  IconButton,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import clubService from "../../../../services/clubService";
import countryService from "../../../../services/countryService";
import MembershipRole from "../../../../types/MembershipRole";
import FileImagePicker from "../../../../../../shared/components/ui/FileImagePicker/FileImagePicker";
import SettingsRowCard from "../shared/SettingsRowCard/SettingsRowCard";
import styles from "./ClubSelector.module.css";

interface ClubSelectorProps {
  initialValue?: string | null;
  onChange: (clubId: string | null) => void;
}

type ClubGridItem = {
  id: string;
  name: string;
  country: string;
  shieldUrl: string | null;
  invitationCode: string | null;
};

type CountryOption = {
  id: number;
  name: string;
  code?: string;
};

function resolveErrorMessage(error: any, fallback: string): string {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.detail ||
    error?.response?.data?.title ||
    error?.response?.data?.message ||
    error?.message;

  if (status === 409) {
    return "No se puede eliminar el club porque tiene datos relacionados.";
  }

  if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
    return apiMessage;
  }

  return fallback;
}

const ClubSelector: React.FC<ClubSelectorProps> = ({ initialValue, onChange }) => {
  const mountedRef = useRef(true);
  const objectUrlsRef = useRef<string[]>([]);
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("lg"));

  const [clubs, setClubs] = useState<ClubGridItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(initialValue ?? null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [newClubName, setNewClubName] = useState("");
  const [newClubCountryCode, setNewClubCountryCode] = useState("");
  const [newClubEmblemFile, setNewClubEmblemFile] = useState<File | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clubToDelete, setClubToDelete] = useState<ClubGridItem | null>(null);

  const clearObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore cleanup errors.
      }
    });
    objectUrlsRef.current = [];
  };

  const loadCountries = async () => {
    setCountriesLoading(true);
    try {
      const countriesResp = await countryService.getCountries();
      if (!mountedRef.current) return;
      setCountries((countriesResp ?? []).filter((country) => !!country.code));
    } catch {
      if (!mountedRef.current) return;
      setCountries([]);
    } finally {
      if (!mountedRef.current) return;
      setCountriesLoading(false);
    }
  };

  const loadClubs = async () => {
    setLoading(true);
    setError(null);
    try {
      const clubsResp = await clubService.getUserClubs();
      const nextObjectUrls: string[] = [];
      const mappedClubs = await Promise.all(
        clubsResp.map(async (club) => {
          const fullClub = await clubService.getClubById(club.clubId);
          let shieldUrl: string | null = club.shieldUrl || fullClub?.emblemUrl || null;

          try {
            const emblem = await clubService.getClubEmblem(club.clubId);
            if (emblem?.data) {
              const blob = new Blob([emblem.data], {
                type: emblem.contentType ?? "image/png",
              });
              const objectUrl = URL.createObjectURL(blob);
              nextObjectUrls.push(objectUrl);
              shieldUrl = objectUrl;
            }
          } catch {
            // Keep direct URL fallback when emblem download is not available.
          }

          return {
            id: club.clubId,
            name: club.clubName,
            country: fullClub?.country?.name ?? "-",
            shieldUrl,
            invitationCode: fullClub?.invitationCode ?? null,
          };
        })
      );

      if (!mountedRef.current) {
        nextObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      clearObjectUrls();
      objectUrlsRef.current = nextObjectUrls;
      setClubs(mappedClubs);
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(String(e?.message ?? "Error cargando clubes"));
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void loadClubs();

    return () => {
      mountedRef.current = false;
      clearObjectUrls();
    };
  }, []);

  useEffect(() => {
    setValue(initialValue ?? null);
  }, [initialValue]);

  const handleTogglePreferred = (clubId: string, checked: boolean) => {
    setSaving(true);
    const nextValue = checked ? clubId : null;
    setValue(nextValue);
    onChange(nextValue);
    setSaving(false);
  };

  const resetCreateForm = () => {
    setNewClubName("");
    setNewClubCountryCode("");
    setNewClubEmblemFile(null);
    setCreateErrors({});
  };

  const openCreateDialog = () => {
    setCreateDialogOpen(true);
    setError(null);
    resetCreateForm();
    if (!countries.length && !countriesLoading) {
      void loadCountries();
    }
  };

  const validateCreateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!newClubName.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (newClubName.length > 200) {
      nextErrors.name = "El nombre no puede exceder 200 caracteres.";
    }
    if (!newClubCountryCode.trim()) {
      nextErrors.countryCode = "Selecciona un país.";
    }
    if (newClubEmblemFile) {
      if (!["image/png", "image/jpeg"].includes(newClubEmblemFile.type)) {
        nextErrors.emblem = "Formato inválido. Usa PNG o JPG.";
      }
      if (newClubEmblemFile.size > 2 * 1024 * 1024) {
        nextErrors.emblem = "El archivo debe ser menor a 2MB.";
      }
    }
    setCreateErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateClub = async () => {
    if (!validateCreateForm()) return;

    setCreateLoading(true);
    setError(null);
    try {
      await clubService.createClubMultipart({
        name: newClubName.trim(),
        countryCode: newClubCountryCode,
        roleId: MembershipRole.Coach,
        emblem: newClubEmblemFile ?? undefined,
      });

      if (mountedRef.current) {
        setCreateDialogOpen(false);
      }

      try {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: { message: "Club creado correctamente.", severity: "success" },
          })
        );
      } catch {
        // Ignore snackbar errors.
      }

      await loadClubs();
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(resolveErrorMessage(e, "No se pudo crear el club."));
    } finally {
      if (!mountedRef.current) return;
      setCreateLoading(false);
    }
  };

  const openDeleteDialog = (club: ClubGridItem) => {
    setClubToDelete(club);
    setDeleteDialogOpen(true);
    setError(null);
  };

  const handleDeleteClub = async () => {
    if (!clubToDelete) return;

    setDeleteLoading(true);
    setError(null);
    try {
      await clubService.deleteClub(clubToDelete.id);

      if (value === clubToDelete.id) {
        setValue(null);
        onChange(null);
      }

      if (mountedRef.current) {
        setDeleteDialogOpen(false);
        setClubToDelete(null);
      }

      try {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: { message: "Club eliminado correctamente.", severity: "success" },
          })
        );
      } catch {
        // Ignore snackbar errors.
      }

      await loadClubs();
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(resolveErrorMessage(e, "No se pudo eliminar el club."));
    } finally {
      if (!mountedRef.current) return;
      setDeleteLoading(false);
    }
  };

  return (
    <div className={styles.dialogContent}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" className={styles.helperText}>
          Se muestran tus clubes. Puedes crear y eliminar clubes. El borrado solo aplica si no
          tienen datos relacionados.
        </Typography>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={`${styles.layout} ${styles.layoutSingle}`}>
          <div className={styles.panel}>
            <div className={styles.listHeader}>
              <Typography variant="subtitle1" fontWeight={700}>
                Mis clubes
              </Typography>
              <Button variant="contained" size="small" onClick={openCreateDialog}>
                Crear club
              </Button>
            </div>

            <div className={styles.listWrap}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : clubs.length === 0 ? (
                <div className={styles.emptyState}>No hay clubes disponibles para configurar.</div>
              ) : isCompact ? (
                <div className={styles.cardList}>
                  {clubs.map((club) => (
                    <SettingsRowCard
                      key={club.id}
                      title={club.name}
                      data-testid={`club-row-card-${club.id}`}
                      fields={[
                        { label: "País", value: club.country },
                        {
                          label: "Escudo",
                          value: club.shieldUrl ? (
                            <img
                              src={club.shieldUrl}
                              alt={`Escudo ${club.name}`}
                              className={styles.shieldImage}
                            />
                          ) : (
                            "-"
                          ),
                        },
                        { label: "Código de invitación", value: club.invitationCode ?? "-" },
                        {
                          label: "Preferido",
                          value: (
                            <Switch
                              checked={club.id === value}
                              onChange={(e) => handleTogglePreferred(club.id, e.target.checked)}
                              disabled={saving}
                              size="small"
                              inputProps={{ "aria-label": "Marcar club preferido" }}
                            />
                          ),
                        },
                      ]}
                      actions={
                        <Tooltip title="Eliminar club">
                          <span>
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => openDeleteDialog(club)}
                              disabled={deleteLoading || loading}
                              aria-label={`Eliminar ${club.name}`}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      }
                    />
                  ))}
                </div>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>País</TableCell>
                      <TableCell>Escudo</TableCell>
                      <TableCell>Código de invitación</TableCell>
                      <TableCell>Preferido</TableCell>
                      <TableCell>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clubs.map((club) => (
                      <TableRow key={club.id} hover>
                        <TableCell>{club.name}</TableCell>
                        <TableCell>{club.country}</TableCell>
                        <TableCell>
                          {club.shieldUrl ? (
                            <img
                              src={club.shieldUrl}
                              alt={`Escudo ${club.name}`}
                              className={styles.shieldImage}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{club.invitationCode ?? "-"}</TableCell>
                        <TableCell>
                          <Switch
                            checked={club.id === value}
                            onChange={(e) => handleTogglePreferred(club.id, e.target.checked)}
                            disabled={saving}
                            size="small"
                            inputProps={{ "aria-label": "Marcar club preferido" }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Eliminar club">
                            <span>
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => openDeleteDialog(club)}
                                disabled={deleteLoading || loading}
                                aria-label={`Eliminar ${club.name}`}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </Stack>

      <Dialog
        open={createDialogOpen}
        onClose={() => !createLoading && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Crear club</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              error={!!createErrors.name}
              helperText={createErrors.name}
              fullWidth
              inputProps={{ maxLength: 200 }}
            />

            <FormControl fullWidth error={!!createErrors.countryCode}>
              <InputLabel id="club-selector-country">País</InputLabel>
              <Select
                labelId="club-selector-country"
                value={newClubCountryCode}
                label="País"
                onChange={(e) => setNewClubCountryCode(String(e.target.value))}
                disabled={countriesLoading}
              >
                {countries.map((country) => (
                  <MenuItem key={country.id} value={country.code ?? ""}>
                    {country.name}
                  </MenuItem>
                ))}
              </Select>
              {createErrors.countryCode && (
                <Typography className={styles.fieldError}>{createErrors.countryCode}</Typography>
              )}
            </FormControl>

            <div>
              <FileImagePicker
                id="club-selector-emblem"
                label="Seleccionar escudo"
                accept="image/png, image/jpeg"
                file={newClubEmblemFile}
                onChange={(file) => setNewClubEmblemFile(file)}
              />
              {createErrors.emblem && (
                <Typography className={styles.fieldError}>{createErrors.emblem}</Typography>
              )}
            </div>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={createLoading}>
            Cancelar
          </Button>
          <Button onClick={handleCreateClub} variant="contained" disabled={createLoading}>
            {createLoading ? <CircularProgress size={18} /> : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar club</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Seguro que quieres eliminar el club
            {clubToDelete?.name ? ` \"${clubToDelete.name}\"` : ""}? Esta acción solo será
            posible si el club no tiene datos relacionados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteClub}
            color="error"
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={18} /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ClubSelector;
