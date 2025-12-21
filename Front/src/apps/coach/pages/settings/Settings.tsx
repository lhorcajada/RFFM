import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import configurationCoachService, {
  ConfigurationCoachDto,
  ConfigurationCoachRequest,
} from "../../services/configurationCoachService";
import clubService from "../../services/clubService";
import teamService from "../../services/teamService";
import styles from "./Settings.module.css";
import {
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  const [preferredClubId, setPreferredClubId] = useState<string | null>(null);
  const [preferredTeamId, setPreferredTeamId] = useState<string | null>(null);
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
      if (first?.preferredClubId) {
        const teamsResp = await teamService.getTeams(first.preferredClubId);
        setTeams(
          teamsResp.map((t) => ({
            id: t.id,
            name: t.name,
          }))
        );
        // seleccionar el team guardado si existe
        setPreferredTeamId(first?.preferredTeamId ?? null);
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const loadTeams = async () => {
      if (!preferredClubId) {
        setTeams([]);
        setPreferredTeamId(null);
        return;
      }
      const teamsResp = await teamService.getTeams(preferredClubId);
      setTeams(
        teamsResp.map((t) => ({
          id: t.id,
          name: t.name,
        }))
      );
    };
    loadTeams();
  }, [preferredClubId]);

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

  if (!loading && !config && clubs.length === 0) {
    return (
      <BaseLayout hideFooterMenu>
        <ContentLayout title={"Ajustes"} subtitle={null}>
          <div className={styles.root}>
            <EmptyState
              title="Sin clubes"
              description="No hay clubes disponibles."
            />
          </div>
        </ContentLayout>
      </BaseLayout>
    );
  }

  const navigate = useNavigate();

  const actionBar = (
    <>
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/coach/dashboard")}
          variant="outlined"
          size="small"
        >
          Volver
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar"}
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
      </div>
    </>
  );

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
        subtitle={<span>Preferencias del entrenador</span>}
        actionBar={actionBar}
      >
        <div className={styles.root}>
          <div className={styles.formRow}>
            <div className={styles.label}>Club preferido</div>
            <div className={styles.grow}>
              <FormControl fullWidth>
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
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.label}>Equipo preferido</div>
            <div className={styles.grow}>
              <FormControl fullWidth>
                <InputLabel id="team-label">Equipo</InputLabel>
                <Select
                  labelId="team-label"
                  value={preferredTeamId ?? ""}
                  label="Equipo"
                  onChange={(e) => setPreferredTeamId(e.target.value as string)}
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
        </div>
      </ContentLayout>
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
