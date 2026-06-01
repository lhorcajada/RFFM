import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import teamService, { TeamResponse } from "../../../../services/teamService";
import CategorySelect from "../../../../components/CategorySelect/CategorySelect";
import LeagueSelect from "../../../../components/LeagueSelect/LeagueSelect";
import SeasonSelector from "../../../../../../shared/components/ui/SeasonSelector/SeasonSelector";
import styles from "./TeamManager.module.css";
import seasonService from "../../../../services/seasonService";

interface TeamFormState {
  name: string;
  categoryId?: number | null;
  leagueId?: number | null;
  leagueGroup?: number | null;
  photo?: File | null;
  urlPhoto?: string | null;
  seasonId?: string | null;
  isPreferred?: boolean;
}

interface TeamManagementDialogProps {
  open?: boolean;
  onClose?: () => void;
  onChanged?: () => void;
  clubId: string;
  inline?: boolean;
}

export default function TeamManager({ open, onChanged, clubId }: TeamManagementDialogProps) {
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [form, setForm] = useState<TeamFormState>({ name: "", categoryId: undefined, leagueId: undefined, leagueGroup: undefined, photo: null, urlPhoto: null, seasonId: undefined });
  const [seasonPreferredTeamId, setSeasonPreferredTeamId] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>(undefined);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) {
      setTeams([]);
      setSelectedTeamId("");
      setForm({ name: "", categoryId: undefined, leagueId: undefined, leagueGroup: undefined, photo: null, urlPhoto: null, seasonId: undefined, isPreferred: false });
      setError("Selecciona un club para administrar los equipos.");
      return;
    }
    void loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clubId, selectedSeasonId]);

  useEffect(() => {
    if (!selectedSeasonId) {
      setSeasonPreferredTeamId(null);
      return;
    }
    let mounted = true;
    (async () => {
      const s = await seasonService.getSeason(selectedSeasonId as string);
      if (!mounted) return;
      setSeasonPreferredTeamId((s as any)?.preferredTeamId ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [selectedSeasonId]);

  const loadTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await teamService.getTeams(clubId, selectedSeasonId as any);
      setTeams(all || []);
    } catch (e: any) {
      setError(String(e?.message ?? "Error cargando equipos"));
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreferred = async (team: TeamResponse, checked: boolean) => {
    if (!selectedSeasonId) {
      setError("Selecciona una temporada");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await teamService.setSeasonPreferredTeam(selectedSeasonId as string, checked ? team.id : null);
      setSeasonPreferredTeamId(checked ? team.id : null);
    } catch (e: any) {
      setError(String(e?.message ?? "Error marcando equipo preferido"));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTeam = async (team: TeamResponse) => {
    setSelectedTeamId(team.id);
    setError(null);
    try {
      const full = await teamService.getTeamById(team.id);
      setForm({
        name: full?.name ?? "",
        categoryId: full?.category?.id ?? undefined,
        leagueId: full?.league?.id ?? undefined,
        leagueGroup: full?.league?.group ?? undefined,
        photo: null,
        urlPhoto: full?.urlPhoto ?? null,
        seasonId: full?.club?.id ? selectedSeasonId ?? undefined : selectedSeasonId ?? undefined,
        isPreferred: full?.id === seasonPreferredTeamId,
      });
      if (full?.urlPhoto) {
        const p = await teamService.fetchTeamPhoto(full.urlPhoto);
        setPhotoPreview(p);
      } else {
        setPhotoPreview(null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? "Error cargando equipo"));
    }
  };

  const handleNewTeam = () => {
    setSelectedTeamId("");
    setForm({ name: "", categoryId: undefined, leagueId: undefined, leagueGroup: undefined, photo: null, urlPhoto: null, seasonId: undefined });
    setPhotoPreview(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.name.trim()) return;
    if (!form.categoryId || Number(form.categoryId) <= 0) {
      setError("Selecciona una categoría.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (!selectedTeamId) {
        // create
        await teamService.createTeam(clubId, {
          name: form.name.trim(),
          categoryId: form.categoryId!,
          leagueId: form.leagueId ?? null,
          leagueGroup: form.leagueGroup ?? null,
          photo: form.photo ?? null,
          seasonId: form.seasonId ?? selectedSeasonId ?? null,
        } as any);
      } else {
        // update
        let urlPhoto = form.urlPhoto ?? null;
        if (form.photo) {
          const uploaded: any = await teamService.uploadTeamPhoto(form.photo);
          urlPhoto = uploaded?.url ?? uploaded ?? null;
        }
        await teamService.updateTeam(selectedTeamId, {
          name: form.name.trim(),
          categoryId: form.categoryId!,
          leagueId: form.leagueId ?? null,
          leagueGroup: form.leagueGroup ?? null,
          urlPhoto,
          clubId,
          seasonId: form.seasonId ?? selectedSeasonId ?? null,
        });
      }

      await loadTeams();
      // If the user marked the team as preferred, set it for the season.
      try {
        const targetSeasonId = form.seasonId ?? selectedSeasonId ?? undefined;
        if (form.isPreferred && targetSeasonId) {
          // find the created/updated team id from server
          const refreshed = await teamService.getTeams(clubId, targetSeasonId as any);
          const found = refreshed.find((t) => t.name === form.name.trim() && t.category?.id === form.categoryId);
          if (found) {
            await teamService.setSeasonPreferredTeam(targetSeasonId as string, found.id);
            setSeasonPreferredTeamId(found.id);
          }
        }
      } catch (e) {
        // ignore pref setting errors here, show later if needed
      }
      onChanged?.();
      handleNewTeam();
    } catch (e: any) {
      setError(String(e?.message ?? "Error guardando equipo"));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className={styles.dialogContent}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" className={styles.helperText}>
          Crea y administra equipos para el club seleccionado. Solo podrás crear equipos en los clubes a los que tienes acceso.
        </Typography>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.layout}>
          <div className={styles.panel}>
            <div className={styles.listHeader}>
              <Typography variant="subtitle1" fontWeight={700}>
                Todos los equipos
              </Typography>
              <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={handleNewTeam}>
                Nuevo equipo
              </Button>
            </div>

            <div className={styles.listWrap}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 180 }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : teams.length === 0 ? (
                <div className={styles.emptyState}>No hay equipos creados para esta temporada.</div>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Categoría</TableCell>
                      <TableCell>Liga</TableCell>
                      <TableCell>Grupo</TableCell>
                      <TableCell>Preferido</TableCell>
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {teams.map((team) => (
                      <TableRow key={team.id} hover>
                        <TableCell>{team.name}</TableCell>
                        <TableCell>{team.category?.name}</TableCell>
                        <TableCell>{team.league?.name ?? "-"}</TableCell>
                        <TableCell>{team.league?.group ?? "-"}</TableCell>
                        <TableCell>
                          <Switch
                            checked={team.id === seasonPreferredTeamId}
                            onChange={(e) => handleTogglePreferred(team, e.target.checked)}
                            size="small"
                            inputProps={{ 'aria-label': 'Marcar preferido' }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleSelectTeam(team)} aria-label="Editar equipo">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <Typography variant="subtitle1" fontWeight={700}>
              {selectedTeamId ? "Editar equipo" : "Crear equipo"}
            </Typography>

            <div className={styles.formGrid}>
              <TextField
                className={styles.fullWidth}
                label="Nombre"
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                size="small"
                inputProps={{ maxLength: 200 }}
              />

              <div style={{ gridColumn: "1 / -1" }}>
                <CategorySelect
                  value={form.categoryId ?? null}
                  onChange={(c) => setForm((cur) => ({ ...cur, categoryId: c?.id ?? undefined, leagueId: undefined }))}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <LeagueSelect
                  categoryId={form.categoryId ?? undefined}
                  value={form.leagueId ?? null}
                  onChange={(l) => setForm((cur) => ({ ...cur, leagueId: l?.id ?? undefined, leagueGroup: l?.group ?? cur.leagueGroup }))}
                />
              </div>

              <TextField
                label="Grupo de liga"
                type="number"
                value={form.leagueGroup ?? ""}
                onChange={(e) => setForm((c) => ({ ...c, leagueGroup: e.target.value ? Number(e.target.value) : undefined }))}
                size="small"
                InputLabelProps={{ shrink: true }}
              />

              <div style={{ gridColumn: "1 / -1" }}>
                <SeasonSelector value={form.seasonId ?? ""} onChange={(s) => setForm((c) => ({ ...c, seasonId: s ?? undefined }))} clubId={clubId} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isPreferred ?? false}
                      onChange={(e) => setForm((c) => ({ ...c, isPreferred: e.target.checked }))}
                      name="isPreferred"
                      size="small"
                    />
                  }
                  label="Marcar como preferido de la temporada"
                />
              </div>

              <div className={styles.fullWidth}>
                <input
                  accept="image/*"
                  style={{ display: "block", marginBottom: 8 }}
                  id="team-photo-input"
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setForm((c) => ({ ...c, photo: f }));
                    if (f) setPhotoPreview(URL.createObjectURL(f));
                  }}
                />
                {photoPreview && <img src={photoPreview} alt="preview" style={{ maxWidth: 160, borderRadius: 6 }} />}
              </div>
            </div>

            <Typography variant="body2" className={styles.helperText}>
              {selectedTeamId ? `Editando ${form.name || selectedTeamId}` : "Completa el formulario para crear un nuevo equipo."}
            </Typography>

            <div className={styles.actionButtons}>
              <Button onClick={handleNewTeam} variant="outlined" size="small">
                Limpiar
              </Button>
              <Button onClick={handleSave} variant="contained" size="small" disabled={saving || !form.name.trim()}>
                {saving ? <CircularProgress size={16} color="inherit" /> : selectedTeamId ? "Guardar cambios" : "Crear equipo"}
              </Button>
            </div>
          </div>
        </div>
      </Stack>
    </div>
  );


  return (
    <>
      {content}
    </>
  );


}
