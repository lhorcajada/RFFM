import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService, {
  ConfigurationCoachDto,
  ConfigurationCoachRequest,
} from "../../services/configurationCoachService";
import clubService from "../../services/clubService";
import teamService from "../../services/teamService";
import seasonService, { type Season } from "../../services/seasonService";
import SeasonManagementDialog from "./components/SeasonManagementDialog";
import styles from "./Settings.module.css";
import {
  Button,
  Chip,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Snackbar,
  Alert,
} from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

const Settings: React.FC = () => {
  const [config, setConfig] = useState<ConfigurationCoachDto | null>(null);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [preferredClubId, setPreferredClubId] = useState<string | null>(null);
  const [preferredTeamId, setPreferredTeamId] = useState<string | null>(null);
  const [seasonManagerOpen, setSeasonManagerOpen] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [configs, clubsResp] = await Promise.all([
        configurationCoachService.getAll(),
        clubService.getUserClubs(),
      ]);
      setClubs(
        clubsResp.map((c) => ({
          id: c.clubId,
          name: c.clubName,
        }))
      );
      const first = configs.length ? configs[0] : null;
      setConfig(first);
      setPreferredClubId(first?.preferredClubId ?? null);
      setLoading(false);
    };
    load();
  }, []);

  const activeSeason = seasons.find((season) => season.active ?? season.isActive) ?? null;

  const formatSeasonDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 10);
    return date.toLocaleDateString("es-ES");
  };

  useEffect(() => {
    const loadTeams = async () => {
      if (!preferredClubId) {
        setSeasons([]);
        setTeams([]);
        setPreferredTeamId(null);
        return;
      }
      const seasonsResp = await seasonService.getSeasons(preferredClubId);
      setSeasons(seasonsResp);
      const teamsResp = await teamService.getTeams(preferredClubId);
      setTeams(
        teamsResp.map((t) => ({
          id: t.id,
          name: t.name,
        }))
      );
      setPreferredTeamId(config?.preferredTeamId ?? null);
    };
    loadTeams();
  }, [config?.preferredTeamId, preferredClubId]);

  const handleSave = async () => {
    const payload: ConfigurationCoachRequest = {
      coachId: config?.coachId ?? "",
      preferredClubId: preferredClubId ?? null,
      preferredTeamId: preferredTeamId ?? null,
    };
    try {
      setSaving(true);
      if (config) {
        await configurationCoachService.update(config.id, payload);
      } else {
        await configurationCoachService.create(payload);
      }
      const all = await configurationCoachService.getAll();
      const first = all.length ? all[0] : null;
      setConfig(first);
      setSnackbar({
        open: true,
        message: "Configuración guardada correctamente",
        severity: "success",
      });
    } catch (e) {
      setSnackbar({
        open: true,
        message: "Error guardando la configuración",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!config) return;
    try {
      await configurationCoachService.remove(config.id);
      setConfig(null);
      setPreferredClubId(null);
      setPreferredTeamId(null);
      try {
        sessionStorage.removeItem("coach_preferred_selection");
      } catch (e) {}
      setSnackbar({
        open: true,
        message: "Configuración eliminada",
        severity: "success",
      });
    } catch (e) {
      setSnackbar({
        open: true,
        message: "Error al eliminar la configuración",
        severity: "error",
      });
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={"Ajustes"}
        subtitle={<span>Configuración del entrenador</span>}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/dashboard")}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {config && (
              <Button
                variant="outlined"
                color="error"
                onClick={() => setConfirmOpen(true)}
                size="small"
              >
                Eliminar
              </Button>
            )}
            <Button
              onClick={handleSave}
              variant="contained"
              color="primary"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </Stack>
        }
      >
        <div className={styles.root}>
          {/* ── Left category sidebar ── */}
          <nav className={styles.categoryNav}>
            <div className={`${styles.categoryItem} ${styles.categoryItemActive}`}>
              Preferencias
            </div>
          </nav>

          {/* ── Right settings panel ── */}
          <div className={styles.settingsPanel}>
            {/* Panel header */}
            <div className={styles.panelHeader}>
              <span className={styles.panelHeaderDot} />
              <span className={styles.panelHeaderTitle}>Club y equipo preferido</span>
            </div>

            {/* Club preference row */}
            <div className={styles.settingRow}>
              <div className={styles.settingLabel}>Club preferido</div>
              <div className={styles.settingControl}>
                {clubs.length === 0 && !loading ? (
                  <div className={styles.emptyNotice}>
                    Sin clubes. No hay clubes disponibles para configurar.
                  </div>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel id="club-label">Club</InputLabel>
                    <Select
                      labelId="club-label"
                      value={preferredClubId ?? ""}
                      label="Club"
                      onChange={(e) => setPreferredClubId(e.target.value as string)}
                    >
                      <MenuItem value="">-- Ninguno --</MenuItem>
                      {clubs.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </div>
            </div>

            {/* Team preference row */}
            <div className={styles.settingRow}>
              <div className={styles.settingLabel}>Equipo preferido</div>
              <div className={styles.settingControl}>
                <FormControl fullWidth size="small">
                  <InputLabel id="team-label">Equipo</InputLabel>
                  <Select
                    labelId="team-label"
                    value={preferredTeamId ?? ""}
                    label="Equipo"
                    onChange={(e) => setPreferredTeamId(e.target.value as string)}
                    disabled={!preferredClubId}
                  >
                    <MenuItem value="">-- Ninguno --</MenuItem>
                    {teams.map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <span className={styles.panelHeaderDot} />
                <span className={styles.panelHeaderTitle}>Temporadas</span>
              </div>

              <div className={styles.seasonSummary}>
                <div className={styles.seasonMeta}>
                  <Typography variant="subtitle2" className={styles.sectionTitle}>
                    Temporada activa
                  </Typography>
                  {activeSeason ? (
                    <>
                      <Typography variant="body2" className={styles.seasonName}>
                        {activeSeason.name ?? activeSeason.id}
                      </Typography>
                      <Typography variant="body2" className={styles.seasonRange}>
                        {formatSeasonDate(activeSeason.startDate)} - {formatSeasonDate(activeSeason.endDate)}
                      </Typography>
                    </>
                  ) : (
                    <div className={styles.emptyNotice}>
                      No hay temporada activa. Entra al formulario para crear o activar una temporada.
                    </div>
                  )}
                </div>

                <div className={styles.sectionActions}>
                  <Chip
                    label={seasons.length > 0 ? `${seasons.length} temporadas` : "Sin temporadas"}
                    size="small"
                    variant="outlined"
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setSeasonManagerOpen(true)}
                  >
                    Administrar temporadas
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </ContentLayout>
      <SeasonManagementDialog
        clubId={preferredClubId ?? ""}
        open={seasonManagerOpen}
        onClose={() => setSeasonManagerOpen(false)}
        onChanged={async () => {
          if (!preferredClubId) return;
          const latestSeasons = await seasonService.getSeasons(preferredClubId);
          setSeasons(latestSeasons);
        }}
      />
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Eliminar configuración</DialogTitle>
        <DialogContent>
          ¿Estás seguro de que quieres eliminar la configuración del coach?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button color="error" onClick={handleDeleteConfirmed}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </BaseLayout>
  );
};

export default Settings;
