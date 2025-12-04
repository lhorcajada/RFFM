import React from "react";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import GroupSelector from "../../../../shared/components/ui/GroupSelector/GroupSelector";
import TeamsSelector from "../../../../shared/components/ui/TeamsSelector/TeamsSelector";
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
import SavedConfigs from "../../../../shared/components/ui/SavedConfigs/SavedConfigs";

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
    const isFirst = saved.length === 0;
    const combo: SavedCombo = {
      id,
      competition: selectedCompetition ?? null,
      group: selectedGroup ?? null,
      team: selectedTeam ?? null,
      createdAt: Date.now(),
      isPrimary: isFirst,
    };
    const next = [combo, ...saved];
    // if this is the first saved combo, reuse the same logic as clicking the
    // star: set as primary and apply (which shows the notification)
    if (isFirst) {
      setAsPrimary(id, next);
      applyCombo(id, next);
      return;
    }
    persist(next);
  }

  function removeCombo(id: string) {
    const next = saved.filter((s) => s.id !== id);
    // if we removed the primary, promote the first remaining combo (if any)
    if (primaryId === id) {
      if (next.length > 0) {
        const newPrimary = next[0].id;
        // reuse the same logic as clicking the star so notifications and
        // current selection are updated consistently
        setAsPrimary(newPrimary, next);
        applyCombo(newPrimary, next);
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

  function setAsPrimary(id: string, list?: SavedCombo[]) {
    const current = list ?? saved;
    try {
      localStorage.setItem(STORAGE_PRIMARY, id);
    } catch (e) {
      // ignore
    }
    setPrimaryId(id);
    // update saved array flags using the provided list (if any)
    const next = current.map((s) => ({ ...s, isPrimary: s.id === id }));
    persist(next);
  }

  function applyCombo(id: string, list?: SavedCombo[]) {
    const arr = list ?? saved;
    const combo = arr.find((s) => s.id === id);
    if (!combo) return;
    try {
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify(combo));
    } catch (e) {
      // ignore
    }
    setSnackMsg(
      "Selección aplicada: ahora la aplicación usará esta combinación hasta que la cambies."
    );
    setSnackOpen(true);
  }

  return (
    <BaseLayout>
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
      <SavedConfigs />
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
    </BaseLayout>
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
