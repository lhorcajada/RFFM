import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import configurationCoachService from "../../../services/configurationCoachService";

type Snackbar = {
  open: boolean;
  severity: "success" | "info" | "warning" | "error";
  message: string;
};

export function usePreferredSelection(selectedSeason: string) {
  const navigate = useNavigate();
  const [hasPreferredSelection, setHasPreferredSelection] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [snackbar, setSnackbar] = useState<Snackbar>({
    open: false,
    severity: "info",
    message: "",
  });

  useEffect(() => {
    let timer: number | null = null;
    try {
      const raw = sessionStorage.getItem("coach_preferred_selection");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          type: "team" | "club";
          id: string;
          ts: number;
        };
        const ttl = 24 * 60 * 60 * 1000;
        const age = Date.now() - parsed.ts;
        if (age > ttl) {
          sessionStorage.removeItem("coach_preferred_selection");
          setHasPreferredSelection(false);
        } else {
          setHasPreferredSelection(true);
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
    } catch {}
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoadPreferred() {
    setLoadingConfig(true);
    try {
      const configs = await configurationCoachService.getAll();
      if (configs && configs.length > 0) {
        const cfg = configs[0];
        if (cfg.preferredTeamId) {
          sessionStorage.setItem(
            "coach_preferred_selection",
            JSON.stringify({ type: "team", id: cfg.preferredTeamId, ts: Date.now() })
          );
          setHasPreferredSelection(true);
          navigate(`/coach/dashboard?teamId=${cfg.preferredTeamId}`);
        } else if (cfg.preferredClubId) {
          sessionStorage.setItem(
            "coach_preferred_selection",
            JSON.stringify({ type: "club", id: cfg.preferredClubId, ts: Date.now() })
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
            message: "No hay equipo ni club preferente configurado.",
          });
        }
      } else {
        setSnackbar({
          open: true,
          severity: "info",
          message: "No se encontró configuración de entrenador.",
        });
      }
    } catch {
      setSnackbar({
        open: true,
        severity: "error",
        message: "Error al cargar la configuración preferente.",
      });
    } finally {
      setLoadingConfig(false);
    }
  }

  return { hasPreferredSelection, loadingConfig, snackbar, setSnackbar, handleLoadPreferred };
}
