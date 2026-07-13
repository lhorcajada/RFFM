import React, { useEffect, useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import seasonService, { Season } from "../../../../../services/seasonService";
import { mapApiErrorToMessage } from "../../../../../../../shared/utils/errorMessages";
import SeasonEditorForm, { type SeasonFormState } from "../SeasonEditorForm/SeasonEditorForm";
import SettingsRowCard from "../../shared/SettingsRowCard/SettingsRowCard";
import styles from "./SeasonManager.module.css";

interface SeasonManagerProps {
  open?: boolean;
  onClose?: () => void;
  onChanged?: () => void;
  clubId: string;
  inline?: boolean;
}

function toInputDate(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function buildDefaultForm(): SeasonFormState {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  return {
    name: "",
    startDate: toInputDate(startDate.toISOString()),
    endDate: toInputDate(endDate.toISOString()),
    isActive: true,
  };
}

function seasonToForm(season: Season): SeasonFormState {
  return {
    name: season.name ?? "",
    startDate: toInputDate(season.startDate),
    endDate: toInputDate(season.endDate),
    isActive: season.active ?? season.isActive ?? false,
  };
}

function toIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export default function SeasonManager({ open, onClose, onChanged, clubId }: SeasonManagerProps) {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("lg"));
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [form, setForm] = useState<SeasonFormState>(buildDefaultForm());
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
  const [activeClubId, setActiveClubId] = useState<string>(clubId || "");

  useEffect(() => {
    setActiveClubId(clubId || "");
  }, [clubId]);

  useEffect(() => {
    if (!activeClubId) {
      setSeasons([]);
      setSelectedSeasonId("");
      setForm(buildDefaultForm());
      setError(null);
      return;
    }

    void loadSeasons();
  }, [activeClubId, open]);

  const loadSeasons = async () => {
    if (!activeClubId) return;

    setLoading(true);
    setError(null);
    try {
      const allSeasons = await seasonService.getSeasons(activeClubId);
      setSeasons(allSeasons);

      if (allSeasons.length === 0) {
        setSelectedSeasonId("");
        setForm(buildDefaultForm());
        return;
      }

      const activeSeason =
        allSeasons.find((season) => season.active ?? season.isActive) ?? allSeasons[0];
      setSelectedSeasonId(activeSeason.id);
      setForm(seasonToForm(activeSeason));
    } catch (caughtError) {
      setError(mapApiErrorToMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSeason = (season: Season) => {
    setSelectedSeasonId(season.id);
    setForm(seasonToForm(season));
    setIsFormVisible(true);
    setError(null);
  };

  const handleNewSeason = () => {
    setSelectedSeasonId("");
    setForm(buildDefaultForm());
    setIsFormVisible(true);
    setError(null);
  };

  const handleCancelForm = () => {
    setIsFormVisible(false);
    setError(null);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name || !form.startDate || !form.endDate) {
      return;
    }
    if (!selectedSeasonId && !activeClubId) {
      return;
    }
    if (form.endDate < form.startDate) {
      setError("La fecha fin no puede ser anterior a la fecha de inicio.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const startDate = toIsoDate(form.startDate);
      const endDate = toIsoDate(form.endDate);

      if (selectedSeasonId) {
        await seasonService.updateSeason(selectedSeasonId, name, form.isActive, startDate, endDate);
      } else {
        await seasonService.createSeason(name, form.isActive, startDate, endDate, activeClubId);
      }

      await loadSeasons();
      setIsFormVisible(false);
      onChanged?.();
    } catch (caughtError) {
      setError(mapApiErrorToMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setError(null);
    try {
      await seasonService.deleteSeason(deleteTarget.id);
      setDeleteTarget(null);
      await loadSeasons();
      onChanged?.();
    } catch (caughtError) {
      setError(mapApiErrorToMessage(caughtError));
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId);

  const content = (
    <div className={styles.dialogContent}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" className={styles.helperText}>
          Solo puede existir una temporada activa. Si eliminas una temporada con datos asociados, el sistema bloqueará la acción.
        </Typography>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={`${styles.layout} ${!isFormVisible ? styles.layoutSingle : ""}`}>
          <div className={styles.panel}>
            <div className={styles.listHeader}>
              <Typography variant="subtitle1" fontWeight={700}>
                Todas las temporadas
              </Typography>
              <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={handleNewSeason}>
                Nueva temporada
              </Button>
            </div>

            <div className={styles.listWrap}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : !activeClubId ? (
                <div className={styles.emptyState}>
                  Selecciona o crea un club para ver sus temporadas.
                </div>
              ) : seasons.length === 0 ? (
                <div className={styles.emptyState}>
                  Todavía no hay temporadas creadas.
                </div>
              ) : isCompact ? (
                <div className={styles.cardList}>
                  {seasons.map((season) => {
                    const isActive = season.active ?? season.isActive ?? false;
                    return (
                      <SettingsRowCard
                        key={season.id}
                        title={season.name ?? season.id}
                        data-testid={`season-row-card-${season.id}`}
                        fields={[
                          { label: "Inicio", value: toInputDate(season.startDate) || "-" },
                          { label: "Fin", value: toInputDate(season.endDate) || "-" },
                          {
                            label: "Estado",
                            value: (
                              <Chip
                                size="small"
                                label={isActive ? "Activa" : "Inactiva"}
                                color={isActive ? "success" : "default"}
                                variant={isActive ? "filled" : "outlined"}
                                className={styles.statusChip}
                              />
                            ),
                          },
                        ]}
                        actions={
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleSelectSeason(season)}
                              aria-label="Editar temporada"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteTarget(season)}
                              aria-label="Eliminar temporada"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Inicio</TableCell>
                      <TableCell>Fin</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {seasons.map((season) => {
                      const isSelected = season.id === selectedSeasonId;
                      const isActive = season.active ?? season.isActive ?? false;
                      return (
                        <TableRow key={season.id} selected={isSelected} hover>
                          <TableCell>{season.name ?? season.id}</TableCell>
                          <TableCell>{toInputDate(season.startDate) || "-"}</TableCell>
                          <TableCell>{toInputDate(season.endDate) || "-"}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={isActive ? "Activa" : "Inactiva"}
                              color={isActive ? "success" : "default"}
                              variant={isActive ? "filled" : "outlined"}
                              className={styles.statusChip}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <IconButton size="small" onClick={() => handleSelectSeason(season)} aria-label="Editar temporada">
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => setDeleteTarget(season)} aria-label="Eliminar temporada">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {isFormVisible && (
            <SeasonEditorForm
              form={form}
              isEditing={Boolean(selectedSeasonId)}
              selectedSeasonLabel={selectedSeason?.name ?? selectedSeason?.id}
              saving={saving}
              clubId={activeClubId}
              onClubIdChange={setActiveClubId}
              onChange={setForm}
              onReset={handleNewSeason}
              onCancel={handleCancelForm}
              onSave={handleSave}
            />
          )}
        </div>
      </Stack>
    </div>
  );

  const deleteDialog = (
    <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Eliminar temporada</DialogTitle>
      <DialogContent>
        <Typography>
          ¿Quieres eliminar {deleteTarget?.name ?? "esta temporada"}? Si tiene datos relacionados, la operación se bloqueará.
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
  );

  return (
    <>
      {content}
      {deleteDialog}
    </>
  );
}
