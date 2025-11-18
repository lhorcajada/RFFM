import React from "react";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import CompetitionSelector from "../components/ui/CompetitionSelector";
import GroupSelector from "../components/ui/GroupSelector";
import TeamsSelector from "../components/ui/TeamsSelector";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
// CheckIcon removed (no longer used)
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertProps } from "@mui/material/Alert";
import { useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import styles from "./Settings.module.css";

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

export default function Settings(): JSX.Element {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const [selectedCompetition, setSelectedCompetition] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  const [selectedGroup, setSelectedGroup] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  const [selectedTeam, setSelectedTeam] = useState<
    { id: string; name: string } | undefined
  >(undefined);

  const [saved, setSaved] = useState<SavedCombo[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");

  const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref
  ) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: SavedCombo[] = raw ? JSON.parse(raw) : [];
      setSaved(arr || []);
      const p = localStorage.getItem(STORAGE_PRIMARY);
      setPrimaryId(p);

      // Preload selection so selectors show the team when entering Settings
      let combo: SavedCombo | undefined;
      if (Array.isArray(arr) && arr.length > 0) {
        if (p) combo = arr.find((c) => String(c.id) === String(p));
        if (!combo) combo = arr.find((c) => c.isPrimary) || arr[0];
      }
      if (combo && combo.team) {
        setSelectedCompetition(
          combo.competition
            ? { id: String(combo.competition.id), name: combo.competition.name }
            : undefined
        );
        setSelectedGroup(
          combo.group
            ? { id: String(combo.group.id), name: combo.group.name }
            : undefined
        );
        setSelectedTeam(
          combo.team
            ? { id: String(combo.team.id), name: combo.team.name }
            : undefined
        );
      }
    } catch (e) {
      setSaved([]);
      setPrimaryId(null);
    }
  }, []);

  // when primaryId is known, preload the corresponding combo into selectors
  useEffect(() => {
    if (!primaryId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: SavedCombo[] = raw ? JSON.parse(raw) : [];
      const combo = arr.find((c) => c.id === primaryId);
      if (combo) {
        setSelectedCompetition(
          combo.competition
            ? { id: String(combo.competition.id), name: combo.competition.name }
            : undefined
        );
        setSelectedGroup(
          combo.group
            ? { id: String(combo.group.id), name: combo.group.name }
            : undefined
        );
        setSelectedTeam(
          combo.team
            ? { id: String(combo.team.id), name: combo.team.name }
            : undefined
        );
      }
    } catch (e) {
      // ignore
    }
  }, [primaryId]);

  function persist(list: SavedCombo[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setSaved(list);
    try {
      // notify other components (e.g. Footer) that saved combinations changed
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
    } catch (e) {
      // ignore (e.g., SSR environments)
    }
  }

  function teamAlreadySaved(teamId: string | undefined) {
    if (!teamId) return false;
    return saved.some((s) => String(s.team?.id ?? "") === String(teamId));
  }

  function saveCombination() {
    // require a selected team and avoid duplicates
    if (!selectedTeam) {
      setSnackMsg("Selecciona un equipo antes de guardar la combinación.");
      setSnackOpen(true);
      return;
    }
    if (teamAlreadySaved(selectedTeam.id)) {
      setSnackMsg("Este equipo ya forma parte de una combinación guardada.");
      setSnackOpen(true);
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const combo: SavedCombo = {
      id,
      competition: selectedCompetition ?? null,
      group: selectedGroup ?? null,
      team: selectedTeam ?? null,
      createdAt: Date.now(),
      isPrimary: false,
    };
    const next = [combo, ...saved];
    persist(next);
  }

  function removeCombo(id: string) {
    const next = saved.filter((s) => s.id !== id);
    // if we removed the primary, promote the first remaining combo (if any)
    if (primaryId === id) {
      if (next.length > 0) {
        const newPrimary = next[0].id;
        localStorage.setItem(STORAGE_PRIMARY, newPrimary);
        setPrimaryId(newPrimary);
        const promoted = next.map((s) => ({
          ...s,
          isPrimary: s.id === newPrimary,
        }));
        persist(promoted);
        return;
      } else {
        // no combos left
        localStorage.removeItem(STORAGE_PRIMARY);
        setPrimaryId(null);
        persist(next);
        return;
      }
    }
    persist(next);
  }

  function setAsPrimary(id: string) {
    localStorage.setItem(STORAGE_PRIMARY, id);
    setPrimaryId(id);
    // update saved array flags
    const next = saved.map((s) => ({ ...s, isPrimary: s.id === id }));
    persist(next);
  }

  function applyCombo(id: string) {
    const combo = saved.find((s) => s.id === id);
    if (!combo) return;
    // Save current selection (not changing primary)
    localStorage.setItem(STORAGE_CURRENT, JSON.stringify(combo));
    // Optionally, you might want to notify other parts of the app
    // For now we just persist it to localStorage
    setSnackMsg(
      "Selección aplicada: ahora la aplicación usará esta combinación hasta que la cambies."
    );
    setSnackOpen(true);
  }

  return (
    <>
      <Paper className={styles.paper}>
        <HeaderContainer
          saveCombination={saveCombination}
          selectedTeam={selectedTeam}
          teamAlreadySaved={teamAlreadySaved}
        />

        <Box className={styles.topBox}>
          <Typography variant="subtitle1">
            Guardar combinación por defecto
          </Typography>
          <div className={styles.selectorsWrap}>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={4}>
                <CompetitionSelector
                  onChange={(c) => setSelectedCompetition(c)}
                  value={selectedCompetition?.id}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <GroupSelector
                  competitionId={selectedCompetition?.id}
                  onChange={(g) => setSelectedGroup(g)}
                  value={selectedGroup?.id}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TeamsSelector
                  competitionId={selectedCompetition?.id}
                  groupId={selectedGroup?.id}
                  onChange={(t) => setSelectedTeam(t)}
                  value={selectedTeam?.id}
                />
              </Grid>
            </Grid>
          </div>
        </Box>

        <Divider className={styles.divider} />

        <Typography variant="subtitle1">Combinaciones guardadas</Typography>
        {saved.length === 0 ? (
          <Typography variant="body2" style={{ marginTop: 8 }}>
            No hay combinaciones guardadas.
          </Typography>
        ) : (
          <List>
            {saved.map((s) => (
              <ListItem key={s.id} divider alignItems="flex-start">
                <ListItemAvatar>
                  <Avatar
                    className={styles.avatar}
                    sx={{ bgcolor: s.isPrimary ? "primary.main" : undefined }}
                    alt={s.team?.name ?? "Equipo"}
                  >
                    {s.team?.name ? s.team.name.charAt(0).toUpperCase() : "-"}
                  </Avatar>
                </ListItemAvatar>

                <ListItemText
                  className={styles.listItemText}
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
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {new Date(s.createdAt).toLocaleString()}
                      {s.isPrimary ? " • Principal" : ""}
                    </Typography>
                  }
                />

                {isSm ? (
                  <Box className={styles.actionsInlineBox}>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      className={styles.actionsRow}
                    >
                      <IconButton
                        aria-label="primary"
                        title={
                          primaryId === s.id
                            ? "Aplicar y principal"
                            : "Marcar como principal y aplicar"
                        }
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
                        title="Eliminar"
                        onClick={() => removeCombo(s.id)}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                ) : (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="primary"
                      title={
                        primaryId === s.id
                          ? "Aplicar y principal"
                          : "Marcar como principal y aplicar"
                      }
                      onClick={() => {
                        setAsPrimary(s.id);
                        applyCombo(s.id);
                      }}
                      color={primaryId === s.id ? "primary" : "default"}
                    >
                      {primaryId === s.id ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      title="Eliminar"
                      onClick={() => removeCombo(s.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
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

function HeaderContainer({
  saveCombination,
  selectedTeam,
  teamAlreadySaved,
}: {
  saveCombination: () => void;
  selectedTeam?: { id: string; name: string } | undefined;
  teamAlreadySaved: (teamId: string | undefined) => boolean;
}) {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box>
      <Stack
        direction={isSm ? "column" : "row"}
        spacing={1}
        alignItems={isSm ? "stretch" : "center"}
      >
        <div style={{ flex: 1 }}>
          <Typography variant="h5">Configuración</Typography>
          <Typography variant="body2" style={{ marginTop: 8 }}>
            Aquí podrás añadir opciones de configuración de la aplicación.
          </Typography>
        </div>
        <Box className={styles.headerButtons} sx={{ mt: isSm ? 1 : 0 }}>
          <Button
            variant="contained"
            onClick={saveCombination}
            disabled={!selectedTeam || teamAlreadySaved(selectedTeam?.id)}
            fullWidth={isSm}
            sx={{
              minWidth: 140,
              "&.Mui-disabled": {
                opacity: 0.85,
                backgroundColor: (theme) =>
                  theme.palette.action.disabledBackground,
                color: (theme) => theme.palette.action.disabled,
                boxShadow: "none",
              },
            }}
          >
            Guardar combinación
          </Button>
          <Button fullWidth={isSm} component={Link} to="/" variant="outlined">
            Volver al dashboard
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
