import React from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import styles from "./SavedConfigs.module.css";
import { settingsService } from "../../../../apps/federation/services/federationApi";

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
  const [snackOpen, setSnackOpen] = React.useState(false);
  const [snackMsg, setSnackMsg] = React.useState("");

  const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref
  ) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  });

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
  }, []);

  async function loadSettings() {
    try {
      const arr = await settingsService.getSettings();
      setSaved(arr || []);
      const primary = arr.find((c) => c.isPrimary);
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
      await settingsService.setPrimarySettings(id);
      await loadSettings();
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
      const msg = "Combinación marcada como principal.";
      setSnackMsg(msg);
      setSnackOpen(true);
    } catch (e) {
      setSnackMsg("Error al marcar como principal.");
      setSnackOpen(true);
    }
  }

  function applyCombo(id: string) {
    const combo = saved.find((s) => s.id === id);
    if (!combo) return;
    try {
      window.dispatchEvent(new Event("rffm.current_selection_changed"));
      const msg =
        "Selección aplicada: ahora la aplicación usará esta combinación hasta que la cambies.";
      setSnackMsg(msg);
      setSnackOpen(true);
      try {
        window.dispatchEvent(
          new CustomEvent("rffm.notify", {
            detail: { msg, severity: "success" },
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
      await settingsService.deleteSettings(id);
      await persist();
      setSnackMsg("Combinación eliminada correctamente.");
      setSnackOpen(true);
    } catch (e) {
      setSnackMsg("Error al eliminar la combinación.");
      setSnackOpen(true);
    }
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
            <List className={styles.list}>
              {saved.map((s) => (
                <ListItem
                  key={s.id}
                  divider
                  className={isMobile ? styles.listItemMobile : styles.listItem}
                >
                  <Box className={styles.itemBox}>
                    <ListItemAvatar>
                      <Avatar
                        className={styles.avatar}
                        alt={s.teamName ?? "Equipo"}
                      >
                        {s.teamName ? s.teamName.charAt(0).toUpperCase() : "-"}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack spacing={0.25}>
                          <Typography variant="subtitle2">
                            {s.teamName ?? "-"}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            className={styles.chipsRow}
                          >
                            <Chip
                              size="small"
                              label={s.competitionName ?? "-"}
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={s.groupName ?? "-"}
                              variant="outlined"
                            />
                          </Stack>
                        </Stack>
                      }
                      secondary={new Date(s.createdAt).toLocaleString()}
                      className={isMobile ? styles.listItemTextMobile : ""}
                    />
                    {!isMobile && (
                      <div className={styles.actionsInlineBox}>
                        <IconButton
                          aria-label="primary"
                          onClick={() => {
                            setAsPrimary(s.id);
                            applyCombo(s.id);
                          }}
                          color={primaryId === s.id ? "primary" : "default"}
                          size="small"
                        >
                          {primaryId === s.id ? (
                            <StarIcon />
                          ) : (
                            <StarBorderIcon />
                          )}
                        </IconButton>
                        <IconButton
                          aria-label="delete"
                          onClick={() => removeCombo(s.id)}
                          size="small"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </div>
                    )}
                  </Box>
                  {isMobile && (
                    <div className={styles.actionsInlineBox}>
                      <IconButton
                        aria-label="primary"
                        onClick={() => {
                          setAsPrimary(s.id);
                          applyCombo(s.id);
                        }}
                        color={primaryId === s.id ? "primary" : "default"}
                        size="small"
                      >
                        {primaryId === s.id ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                      <IconButton
                        aria-label="delete"
                        onClick={() => removeCombo(s.id)}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </div>
                  )}
                </ListItem>
              ))}
            </List>
          </>
        )}
      </div>
      <Snackbar
        open={snackOpen}
        autoHideDuration={4000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackOpen(false)} severity="success">
          {snackMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
