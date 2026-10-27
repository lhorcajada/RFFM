import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import configurationCoachService from "../../services/configurationCoachService";
import seasonService from "../../services/seasonService";
import { coachAuthService } from "../../services/authService";
import styles from "./Settings.module.css";
import ClubSelector from "./components/ClubSelector/ClubSelector";
import MyTeams from "./components/MyTeams/MyTeams";
import { Button, Stack, useMediaQuery } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SeasonOption from "./components/Seasons/SeasonOption/SeasonOption";
import NotificationSettings from "./components/NotificationSettings/NotificationSettings";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";

type SettingsSection = "seasons" | "clubs" | "teams" | "notifications";

const SECTIONS: {
  key: SettingsSection;
  label: string;
  description: string;
  icon: React.ReactNode;
  coachOnly: boolean;
}[] = [
  { key: "clubs", label: "Mis clubes", description: "Elige tu club preferido.", icon: <HomeWorkOutlinedIcon fontSize="small" />, coachOnly: true },
  { key: "seasons", label: "Temporadas", description: "Gestiona las temporadas de tu club preferido.", icon: <EventNoteOutlinedIcon fontSize="small" />, coachOnly: true },
  { key: "teams", label: "Mis equipos", description: "Elige tu equipo preferido.", icon: <GroupsOutlinedIcon fontSize="small" />, coachOnly: true },
  { key: "notifications", label: "Notificaciones", description: "Avisos que quieres recibir.", icon: <NotificationsNoneOutlinedIcon fontSize="small" />, coachOnly: false },
];

const Settings: React.FC = () => {
  useAuditPageAccess('Settings');
  const roles = coachAuthService.getRoles();
  const isPlayerOrFamily =
    (roles.includes("Player") || roles.includes("FamilyPlayer") || roles.includes("FamilyMember")) &&
    !roles.includes("Coach") &&
    !roles.includes("Administrator");

  const [preferredClubId, setPreferredClubId] = useState<string | null>(null);
  const [preferredTeamId, setPreferredTeamId] = useState<string | null>(null);
  const [configurationId, setConfigurationId] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const initialSection = isPlayerOrFamily
    ? "notifications"
    : (location.state as { section?: SettingsSection } | null)
        ?.section ?? "seasons";
  const [selectedSection, setSelectedSection] = useState<SettingsSection>(initialSection);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width:600px)");
  const visibleSections = SECTIONS.filter((section) => !section.coachOnly || !isPlayerOrFamily);
  const activeSection = SECTIONS.find((section) => section.key === selectedSection) ?? SECTIONS[1];

  const selectSection = (key: SettingsSection) => {
    setSelectedSection(key);
    setMenuOpen(false);
  };

  useEffect(() => {
    const load = async () => {
      const current = await configurationCoachService.getCurrent();
      setConfigurationId(current?.id ?? null);
      setPreferredClubId(current?.preferredClubId ?? null);
      setPreferredTeamId(current?.preferredTeamId ?? null);
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
          {isMobile ? (
            <div className={styles.sectionPicker}>
              <button
                type="button"
                className={styles.sectionPickerButton}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label={`Sección: ${activeSection.label}`}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className={styles.sectionPickerText}>
                  <span className={styles.sectionPickerCaption}>Sección</span>
                  <span>{activeSection.label}</span>
                </span>
                <ExpandMoreIcon className={menuOpen ? styles.chevronOpen : undefined} />
              </button>
              {menuOpen && (
                <div role="menu" className={styles.sectionMenu}>
                  {visibleSections.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      role="menuitem"
                      className={`${styles.sectionMenuItem} ${selectedSection === section.key ? styles.sectionMenuItemActive : ""}`}
                      onClick={() => selectSection(section.key)}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <nav className={styles.categoryNav} aria-label="Secciones de ajustes">
              {visibleSections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={`${styles.categoryItem} ${selectedSection === section.key ? styles.categoryItemActive : ""}`}
                  aria-current={selectedSection === section.key ? "page" : undefined}
                  onClick={() => selectSection(section.key)}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </nav>
          )}

          {/* ── Right settings panel ── */}
          <div className={styles.settingsPanel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelHeaderTitle}>{activeSection.label}</h2>
              <span className={styles.panelHeaderDescription}>{activeSection.description}</span>
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

              {selectedSection === "notifications" && <NotificationSettings />}
            </div>
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
};

export default Settings;
