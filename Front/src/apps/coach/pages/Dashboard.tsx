import { useEffect, useState } from "react";
import { Button, CircularProgress, Snackbar, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import SettingsIcon from "@mui/icons-material/Settings";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import GroupIcon from "@mui/icons-material/Group";
import AssignmentIcon from "@mui/icons-material/Assignment";
import EventIcon from "@mui/icons-material/Event";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import GavelIcon from "@mui/icons-material/Gavel";
import CasinoIcon from "@mui/icons-material/Casino";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TimelineIcon from "@mui/icons-material/Timeline";
import BaseLayout from "../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../shared/components/ui/ContentLayout/ContentLayout";
import DashboardCard from "../../../shared/components/ui/DashboardCard/DashboardCard";
import styles from "./Dashboard.module.css";

import useTeamAndClub from "../hooks/useTeamAndClub.tsx";
import configurationCoachService from "../services/configurationCoachService";
import SeasonSelector from "../../../shared/components/ui/SeasonSelector/SeasonSelector";

export default function CoachDashboard() {
  const navigate = useNavigate();
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    severity: "success" | "info" | "warning" | "error";
    message: string;
  }>({ open: false, severity: "info", message: "" });
  const [hasPreferredSelection, setHasPreferredSelection] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>(() => {
    try {
      return sessionStorage.getItem("coach_selected_season") || "";
    } catch (e) {
      return "";
    }
  });
  const [, /*hasClubs*/ setHasClubs] = useState(false);
  const [, /*loadingClubs*/ setLoadingClubs] = useState(true);

  const {
    teamTitleNode,
    clubSubtitleNode,
    loading: loadingTeam,
    team,
  } = useTeamAndClub();
  // Nota: se mantiene `setHasClubs`/`setLoadingClubs` para compatibilidad
  // si otras partes del código dependieran de esos setters.

  // hook handles loading team + club subtitle (including object URL cleanup)
  // useTeamAndClub already subscribes to location changes when needed

  useEffect(() => {
    // Al montar, comprobar si hay una selección preferente guardada en sessionStorage
    let mounted = true;
    let timer: number | null = null;
    try {
      const raw = sessionStorage.getItem("coach_preferred_selection");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          type: "team" | "club";
          id: string;
          ts: number;
        };
        // validez 24 horas
        const ttl = 24 * 60 * 60 * 1000;
        const age = Date.now() - parsed.ts;
        if (age > ttl) {
          sessionStorage.removeItem("coach_preferred_selection");
          setHasPreferredSelection(false);
        } else {
          setHasPreferredSelection(true);
          // programar expiración para re-mostrar el botón
          const remaining = ttl - age;
          timer = window.setTimeout(() => {
            sessionStorage.removeItem("coach_preferred_selection");
            setHasPreferredSelection(false);
          }, remaining) as unknown as number;

          if (parsed.type === "team") {
            navigate(`/coach/dashboard?teamId=${parsed.id}`);
          } else if (parsed.type === "club") {
            navigate(`/coach/squad?clubId=${parsed.id}`);
          }
        }
      }
    } catch (e) {
      // ignore
    }
    // SeasonSelector component carga las temporadas; no duplicar carga aquí.
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BaseLayout appTitle="Futbol Base - Entrenadores" hideFooterMenu>
      <ContentLayout
        title={teamTitleNode ?? "Panel de Control de entrenador"}
        subtitle={
          clubSubtitleNode ?? "Gestión y herramientas para entrenadores"
        }
        actionBar={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ minWidth: 180 }}>
              <SeasonSelector
                value={selectedSeason}
                onChange={(v) => {
                  const vv = v ?? "";
                  setSelectedSeason(vv);
                  try {
                    sessionStorage.setItem("coach_selected_season", vv);
                  } catch (e) {}
                }}
                size="small"
              />
            </div>
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => navigate("/")}
              sx={{ textTransform: "none" }}
            >
              Volver al inicio
            </Button>
            {!hasPreferredSelection && (
              <Button
                variant="outlined"
                startIcon={<SportsFootballIcon />}
                onClick={async () => {
                  setLoadingConfig(true);
                  try {
                    const configs = await configurationCoachService.getAll();
                    if (configs && configs.length > 0) {
                      const cfg = configs[0];
                      if (cfg.preferredTeamId) {
                        sessionStorage.setItem(
                          "coach_preferred_selection",
                          JSON.stringify({
                            type: "team",
                            id: cfg.preferredTeamId,
                            ts: Date.now(),
                          })
                        );
                        setHasPreferredSelection(true);
                        navigate(
                          `/coach/dashboard?teamId=${cfg.preferredTeamId}`
                        );
                      } else if (cfg.preferredClubId) {
                        sessionStorage.setItem(
                          "coach_preferred_selection",
                          JSON.stringify({
                            type: "club",
                            id: cfg.preferredClubId,
                            ts: Date.now(),
                          })
                        );
                        setHasPreferredSelection(true);
                        navigate(
                          `/coach/squad?clubId=${cfg.preferredClubId}${
                            selectedSeason ? `&seasonId=${selectedSeason}` : ""
                          }`
                        );
                      } else {
                        setSnackbar({
                          open: true,
                          severity: "info",
                          message:
                            "No hay equipo ni club preferente configurado.",
                        });
                      }
                    } else {
                      setSnackbar({
                        open: true,
                        severity: "info",
                        message: "No se encontró configuración de entrenador.",
                      });
                    }
                  } catch (e) {
                    setSnackbar({
                      open: true,
                      severity: "error",
                      message: "Error al cargar la configuración preferente.",
                    });
                  } finally {
                    setLoadingConfig(false);
                  }
                }}
                sx={{ textTransform: "none" }}
              >
                {loadingConfig ? (
                  <CircularProgress size={20} />
                ) : (
                  "Cargar equipo preferente"
                )}
              </Button>
            )}
          </div>
        }
      >
        <div className={styles.container}>
          <div className={styles.cards}>
            {
              <DashboardCard
                title="Configuración"
                description="Ajustes y preferencias."
                icon={
                  <SettingsIcon style={{ fontSize: 40, color: "#05313b" }} />
                }
                to="/coach/settings"
              />
            }

            <DashboardCard
              title="Clubs"
              description="Gestión de clubs."
              icon={
                <SportsFootballIcon
                  style={{ fontSize: 40, color: "#05313b" }}
                />
              }
              to={`/coach/clubs${
                selectedSeason ? `?seasonId=${selectedSeason}` : ""
              }`}
            />

            {!!teamTitleNode && (
              <>
                <DashboardCard
                  title="Plantilla"
                  description="Gestión de jugadores."
                  icon={
                    <GroupIcon style={{ fontSize: 40, color: "#05313b" }} />
                  }
                  to={
                    team?.id
                      ? `/coach/squad?teamId=${team.id}${
                          selectedSeason ? `&seasonId=${selectedSeason}` : ""
                        }`
                      : `/coach/squad${
                          selectedSeason ? `?seasonId=${selectedSeason}` : ""
                        }`
                  }
                />
                <DashboardCard
                  title="Asistencias"
                  description="Control de asistencias."
                  icon={
                    <AssignmentIcon
                      style={{ fontSize: 40, color: "#05313b" }}
                    />
                  }
                  to={
                    team?.id
                      ? `/coach/attendance?teamId=${team.id}${
                          selectedSeason ? `&seasonId=${selectedSeason}` : ""
                        }`
                      : `/coach/attendance${
                          selectedSeason ? `?seasonId=${selectedSeason}` : ""
                        }`
                  }
                />
                <DashboardCard
                  title="Convocatorias"
                  description="Gestión de convocatorias."
                  icon={
                    <EventIcon style={{ fontSize: 40, color: "#05313b" }} />
                  }
                  to="/coach/convocations"
                />
                <DashboardCard
                  title="Partidos"
                  description="Información de partidos."
                  icon={
                    <EmojiEventsIcon
                      style={{ fontSize: 40, color: "#05313b" }}
                    />
                  }
                  to="/coach/matches"
                />
                <DashboardCard
                  title="Entrenamientos"
                  description="Planificación de entrenamientos."
                  icon={
                    <FitnessCenterIcon
                      style={{ fontSize: 40, color: "#05313b" }}
                    />
                  }
                  to="/coach/trainings"
                />
                <DashboardCard
                  title="Lesionados"
                  description="Control de lesionados."
                  icon={
                    <LocalHospitalIcon
                      style={{ fontSize: 40, color: "#05313b" }}
                    />
                  }
                  to="/coach/injured"
                />
                <DashboardCard
                  title="Modelo de Juego"
                  description="Estrategia y tácticas."
                  icon={
                    <TimelineIcon style={{ fontSize: 40, color: "#05313b" }} />
                  }
                  to="/coach/game-model"
                />
                <DashboardCard
                  title="Sanciones"
                  description="Registro de sanciones."
                  icon={
                    <GavelIcon style={{ fontSize: 40, color: "#05313b" }} />
                  }
                  to="/coach/sanctions"
                />
                <DashboardCard
                  title="Lotería"
                  description="Sistema de lotería."
                  icon={
                    <CasinoIcon style={{ fontSize: 40, color: "#05313b" }} />
                  }
                  to="/coach/lottery"
                />
                <DashboardCard
                  title="Noticias"
                  description="Últimas noticias y comunicados."
                  icon={
                    <NewspaperIcon style={{ fontSize: 40, color: "#05313b" }} />
                  }
                  to="/coach/news"
                />
              </>
            )}
          </div>

          {loadingTeam && (
            <div className={styles.spinnerOverlay}>
              <CircularProgress />
            </div>
          )}
        </div>
      </ContentLayout>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </BaseLayout>
  );
}
