import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService from "../../services/configurationCoachService";
import seasonService from "../../services/seasonService";
import { coachAuthService } from "../../services/authService";
import styles from "./Settings.module.css";
import ClubSelector from "./components/ClubSelector/ClubSelector";
import MyTeams from "./components/MyTeams/MyTeams";
import { Button, Stack } from "@mui/material";
import SeasonOption from "./components/Seasons/SeasonOption/SeasonOption";

const Settings: React.FC = () => {
  const [preferredClubId, setPreferredClubId] = useState<string | null>(null);
  const [preferredTeamId, setPreferredTeamId] = useState<string | null>(null);
  const [configurationId, setConfigurationId] = useState<number | null>(null);
  const navigate = useNavigate();
  const [selectedSection, setSelectedSection] = useState<"seasons" | "clubs" | "teams">("seasons");

  useEffect(() => {
    const load = async () => {
      const configs = await configurationCoachService.getAll();
      const first = configs.length ? configs[0] : null;
      setConfigurationId(first?.id ?? null);
      setPreferredClubId(first?.preferredClubId ?? null);
      setPreferredTeamId(first?.preferredTeamId ?? null);
    };
    load();
  }, []);

  const persistPreferredClub = async (clubId: string | null) => {
    const coachId = coachAuthService.getUserId();
    if (!coachId) {
      throw new Error("No se pudo identificar el coach actual.");
    }

    const payload = {
      coachId,
      preferredClubId: clubId,
      preferredTeamId: null,
    };

    if (configurationId) {
      const updated = await configurationCoachService.update(configurationId, payload);
      setConfigurationId(updated.id);
      return;
    }

    const created = await configurationCoachService.create(payload);
    setConfigurationId(created.id);
  };

  const handlePreferredClubChange = async (id: string | null) => {
    const previousClubId = preferredClubId;
    const previousTeamId = preferredTeamId;

    setPreferredClubId(id);
    setPreferredTeamId(null);

    try {
      await persistPreferredClub(id);
    } catch (error: any) {
      setPreferredClubId(previousClubId);
      setPreferredTeamId(previousTeamId);
      try {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: {
              message: error?.message ?? "No se pudo actualizar el club preferido.",
              severity: "error",
            },
          })
        );
      } catch {
        // Ignore snackbar errors.
      }
      return;
    }

    if (!id) return;

    const seasons = await seasonService.getSeasons(id);
    if (seasons.length === 0) {
      try {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: {
              message: "Ese club no tiene temporadas. Crea una temporada para poder continuar.",
              severity: "warning",
            },
          })
        );
      } catch {
        // Ignore snackbar errors.
      }

      setSelectedSection("seasons");
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
          </Stack>
        }
      >
          <div className={styles.root}>
          {/* ── Left category sidebar ── */}
          <nav className={styles.categoryNav}>
             <div
              className={`${styles.categoryItem} ${selectedSection === "clubs" ? styles.categoryItemActive : ""}`}
              onClick={() => setSelectedSection("clubs")}
            >
              Mis clubes
            </div>
            <div
              className={`${styles.categoryItem} ${selectedSection === "seasons" ? styles.categoryItemActive : ""}`}
              onClick={() => setSelectedSection("seasons")}
            >
              Temporadas
            </div>
            <div
              className={`${styles.categoryItem} ${selectedSection === "teams" ? styles.categoryItemActive : ""}`}
              onClick={() => setSelectedSection("teams")}
            >
              Mis equipos
            </div>
          </nav>

          {/* ── Right settings panel ── */}
          <div className={styles.settingsPanel}>
            {/* Panel header */}
            <div className={styles.panelHeader}>
              <span className={styles.panelHeaderTitle}>
                {selectedSection === "seasons"
                  ? "Temporadas"
                  : selectedSection === "clubs"
                  ? "Mis clubes"
                  : "Mis equipos"}
              </span>
            </div>

            <div className={styles.panelContent}>
              {selectedSection === "seasons" && <SeasonOption clubId={preferredClubId} />}

              {selectedSection === "clubs" && (
                <ClubSelector
                  initialValue={preferredClubId}
                  onChange={(id) => {
                    void handlePreferredClubChange(id);
                  }}
                />
              )}

              {selectedSection === "teams" && (
                <MyTeams
                  clubId={preferredClubId}
                  initialValue={preferredTeamId}
                  onChange={(id) => setPreferredTeamId(id)}
                />
              )}
            </div>
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
};

export default Settings;
