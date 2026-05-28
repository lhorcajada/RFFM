import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService, {
  ConfigurationCoachDto,
  ConfigurationCoachRequest,
} from "../../services/configurationCoachService";
import styles from "./Settings.module.css";
import ClubSelector from "./components/ClubSelector/ClubSelector";
import TeamSelector from "./components/TeamSelector/TeamSelector";
import SeasonsSelector from "./components/SeasonsSelector/SeasonsSelector";
import { Button, Stack, Snackbar, Alert } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

const Settings: React.FC = () => {
  const [config, setConfig] = useState<ConfigurationCoachDto | null>(null);
  const [preferredClubId, setPreferredClubId] = useState<string | null>(null);
  const [preferredTeamId, setPreferredTeamId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const configs = await configurationCoachService.getAll();
      const first = configs.length ? configs[0] : null;
      setConfig(first);
      setPreferredClubId(first?.preferredClubId ?? null);
      setPreferredTeamId(first?.preferredTeamId ?? null);
    };
    load();
  }, []);
  

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
        subtitle={"Configuración"}
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

            <ClubSelector
              initialValue={preferredClubId}
              onChange={(id) => {
                setPreferredClubId(id);
                setPreferredTeamId(null);
              }}
            />

            <TeamSelector
              clubId={preferredClubId}
              initialValue={preferredTeamId}
              onChange={(id) => setPreferredTeamId(id)}
            />

            <SeasonsSelector clubId={preferredClubId} />

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
