import React from "react";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import styles from "./SavedConfigs.module.css";
import ConfigCard from "./ConfigCard";
import {
  settingsService,
  getSettingsForUser,
} from "../../../../apps/federation/services/federationApi";
import { useUser } from "../../../context/UserContext";

type SavedCombo = {
  id: string;
  competitionId?: string;
  competitionName?: string;
  groupId?: string;
  groupName?: string;
  teamId?: string;
  teamName?: string;
  createdAt: number;
  isPrimary?: boolean;
};

export default function SavedConfigs({ compact }: { compact?: boolean }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [saved, setSaved] = React.useState<SavedCombo[]>([]);
  const [primaryId, setPrimaryId] = React.useState<string | null>(null);

  const { user } = useUser();

  React.useEffect(() => {
    loadSettings();
    function onChange() {
      loadSettings();
    }
    window.addEventListener("rffm.saved_combinations_changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("rffm.saved_combinations_changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [user]);

  async function loadSettings() {
    try {
      const arr = await getSettingsForUser(user?.id);
      setSaved(arr || []);
      const primary = arr.find((c: any) => c.isPrimary);
      setPrimaryId(primary?.id || null);
    } catch (e) {
      setSaved([]);
      setPrimaryId(null);
    }
  }

  async function persist() {
    try {
      await loadSettings();
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
    } catch (e) {
      // ignore
    }
  }

  async function setAsPrimary(id: string) {
    try {
      await settingsService.setPrimarySettings(id, user?.id);
      await loadSettings();
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
    } catch (e) {}
  }

  function applyCombo(id: string) {
    const combo = saved.find((s) => s.id === id);
    if (!combo) return;
    try {
      window.dispatchEvent(new Event("rffm.current_selection_changed"));
      try {
        window.dispatchEvent(
          new CustomEvent("rffm.notify", {
            detail: {
              msg: "Selección aplicada: ahora la aplicación usará esta combinación hasta que la cambies.",
              severity: "success",
            },
          })
        );
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }

  async function removeCombo(id: string) {
    try {
      await settingsService.deleteSettings(id, user?.id);
      await persist();
    } catch (e) {}
  }

  return (
    <>
      <div className={styles.root}>
        {saved.length === 0 ? (
          <Typography variant="body2">
            No hay combinaciones guardadas.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" className={styles.explain}>
              La estrella marca la combinación principal que se aplicará
              automáticamente.
            </Typography>
            <div className={styles.cardsGrid}>
              {saved.map((s) => (
                <ConfigCard
                  key={s.id}
                  id={s.id}
                  teamName={s.teamName}
                  competitionName={s.competitionName}
                  groupName={s.groupName}
                  isPrimary={primaryId === s.id}
                  onSetPrimary={(id) => {
                    setAsPrimary(id);
                    applyCombo(id);
                  }}
                  onDelete={removeCombo}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
