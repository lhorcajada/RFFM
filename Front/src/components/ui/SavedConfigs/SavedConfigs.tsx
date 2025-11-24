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
import styles from "./SavedConfigs.module.css";

type SavedCombo = {
  id: string;
  competition?: { id: string; name: string } | null;
  group?: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
  createdAt: number;
  isPrimary?: boolean;
};

const STORAGE_KEY = "rffm.saved_combinations_v1";
const STORAGE_PRIMARY = "rffm.primary_combination_id";
const STORAGE_CURRENT = "rffm.current_selection";

export default function SavedConfigs({ compact }: { compact?: boolean }) {
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
    load();
    function onChange() {
      load();
    }
    window.addEventListener("rffm.saved_combinations_changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("rffm.saved_combinations_changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: SavedCombo[] = raw ? JSON.parse(raw) : [];
      setSaved(arr || []);
      const p = localStorage.getItem(STORAGE_PRIMARY);
      setPrimaryId(p);
    } catch (e) {
      setSaved([]);
      setPrimaryId(null);
    }
  }

  function persist(list: SavedCombo[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
      setSaved(list);
    } catch (e) {
      // ignore
    }
  }

  function setAsPrimary(id: string) {
    try {
      localStorage.setItem(STORAGE_PRIMARY, id);
    } catch (e) {
      // ignore
    }
    setPrimaryId(id);
    const next = saved.map((s) => ({ ...s, isPrimary: s.id === id }));
    persist(next);
  }

  function applyCombo(id: string) {
    const combo = saved.find((s) => s.id === id);
    if (!combo) return;
    try {
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify(combo));
    } catch (e) {
      // ignore
    }
    // notify other parts if needed
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

  function removeCombo(id: string) {
    const next = saved.filter((s) => s.id !== id);
    if (primaryId === id) {
      if (next.length > 0) {
        const newPrimary = next[0].id;
        setAsPrimary(newPrimary);
        applyCombo(newPrimary);
        return;
      } else {
        try {
          localStorage.removeItem(STORAGE_PRIMARY);
        } catch (e) {}
      }
    }
    persist(next);
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
                <ListItem key={s.id} divider>
                  <ListItemAvatar>
                    <Avatar
                      className={styles.avatar}
                      alt={s.team?.name ?? "Equipo"}
                    >
                      {s.team?.name ? s.team.name.charAt(0).toUpperCase() : "-"}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack spacing={0.25}>
                        <Typography variant="subtitle2">
                          {s.team?.name ?? "-"}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          className={styles.chipsRow}
                        >
                          <Chip
                            size="small"
                            label={s.competition?.name ?? "-"}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={s.group?.name ?? "-"}
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>
                    }
                    secondary={new Date(s.createdAt).toLocaleString()}
                  />
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
