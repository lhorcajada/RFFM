import React from "react";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
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
import Slide from "@mui/material/Slide";
import { useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import styles from "./Settings.module.css";
import SavedConfigs from "../../../../shared/components/ui/SavedConfigs/SavedConfigs";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import {
  settingsService,
  getSettingsForUser,
} from "../../services/federationApi";
import { useUser } from "../../../../shared/context/UserContext";

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

export default function Settings(): JSX.Element {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useUser();
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
    loadSettings();
  }, [user]);

  useEffect(() => {
    function handleSettingsChanged() {
      setSnackMsg("Configuración actualizada correctamente.");
      setSnackOpen(true);
    }
    window.addEventListener(
      "rffm.saved_combinations_changed",
      handleSettingsChanged
    );
    return () => {
      window.removeEventListener(
        "rffm.saved_combinations_changed",
        handleSettingsChanged
      );
    };
  }, []);

  async function loadSettings() {
    try {
      console.debug("Settings.loadSettings: starting, userId=", user?.id);
      const arr = await getSettingsForUser(user?.id);
      console.debug(
        "Settings.loadSettings: got settings count=",
        Array.isArray(arr) ? arr.length : typeof arr,
        arr
      );
      setSaved(arr || []);
      const primary = arr.find((c: any) => c.isPrimary);
      const p = primary?.id || null;
      setPrimaryId(p);

      // Preload selection so selectors show the team when entering Settings
      let combo: SavedCombo | undefined;
      if (Array.isArray(arr) && arr.length > 0) {
        if (p) combo = arr.find((c) => String(c.id) === String(p));
        if (!combo) combo = arr.find((c) => c.isPrimary) || arr[0];
      }
      if (combo && combo.teamId) {
        setSelectedCompetition(
          combo.competitionId && combo.competitionName
            ? { id: combo.competitionId, name: combo.competitionName }
            : undefined
        );
        setSelectedGroup(
          combo.groupId && combo.groupName
            ? { id: combo.groupId, name: combo.groupName }
            : undefined
        );
        setSelectedTeam(
          combo.teamId && combo.teamName
            ? { id: combo.teamId, name: combo.teamName }
            : undefined
        );
      }
    } catch (e) {
      setSaved([]);
      setPrimaryId(null);
    }
  }

  // when primaryId is known, preload the corresponding combo into selectors
  useEffect(() => {
    if (!primaryId) return;
    const combo = saved.find((c) => c.id === primaryId);
    if (combo) {
      setSelectedCompetition(
        combo.competitionId && combo.competitionName
          ? { id: combo.competitionId, name: combo.competitionName }
          : undefined
      );
      setSelectedGroup(
        combo.groupId && combo.groupName
          ? { id: combo.groupId, name: combo.groupName }
          : undefined
      );
      setSelectedTeam(
        combo.teamId && combo.teamName
          ? { id: combo.teamId, name: combo.teamName }
          : undefined
      );
    }
  }, [primaryId, saved]);

  function teamAlreadySaved(teamId: string | undefined) {
    if (!teamId) return false;
    return saved.some((s) => String(s.teamId ?? "") === String(teamId));
  }

  async function saveCombination() {
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
    try {
      const isFirst = saved.length === 0;
      const result = await settingsService.saveSettings({
        competitionId: selectedCompetition?.id,
        competitionName: selectedCompetition?.name,
        groupId: selectedGroup?.id,
        groupName: selectedGroup?.name,
        teamId: selectedTeam?.id,
        teamName: selectedTeam?.name,
        isPrimary: isFirst,
        userId: user?.id,
      });
      await loadSettings();
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
      setSnackMsg("Combinación guardada correctamente.");
      setSnackOpen(true);
    } catch (e) {
      setSnackMsg("Error al guardar la combinación.");
      setSnackOpen(true);
    }
  }

  async function removeCombo(id: string) {
    try {
      await settingsService.deleteSettings(id, user?.id);
      await loadSettings();
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
      setSnackMsg("Combinación eliminada correctamente.");
      setSnackOpen(true);
    } catch (e) {
      setSnackMsg("Error al eliminar la combinación.");
      setSnackOpen(true);
    }
  }

  async function setAsPrimary(id: string) {
    try {
      await settingsService.setPrimarySettings(id, user?.id);
      await loadSettings();
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
      setPrimaryId(id);
      setSnackMsg("Combinación marcada como principal.");
      setSnackOpen(true);
    } catch (e) {
      setSnackMsg("Error al marcar como principal.");
      setSnackOpen(true);
    }
  }

  function applyCombo(id: string) {
    const combo = saved.find((s) => s.id === id);
    if (!combo) return;
    setSnackMsg(
      "Selección aplicada: ahora la aplicación usará esta combinación hasta que la cambies."
    );
    setSnackOpen(true);
  }

  return (
    <BaseLayout>
      <ContentLayout title="Configuración">
        <HeaderContainer
          saveCombination={saveCombination}
          selectedTeam={selectedTeam}
          teamAlreadySaved={teamAlreadySaved}
        />

        <Box className={styles.pageContainer}>
          <Box className={styles.topBox}>
            <Typography variant="subtitle1">
              Elige el equipo que quieres añadir a tu lista
            </Typography>
            <div className={styles.selectorsWrap}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6} md={3}>
                  <CompetitionSelector
                    onChange={(c) => setSelectedCompetition(c)}
                    value={selectedCompetition?.id}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <GroupSelector
                    competitionId={selectedCompetition?.id}
                    onChange={(g) => setSelectedGroup(g)}
                    value={selectedGroup?.id}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
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

          <Box className={styles.topBox}>
            <Typography variant="subtitle1">Mis equipos</Typography>
            <SavedConfigs />
          </Box>
        </Box>
      </ContentLayout>
      <Snackbar
        open={snackOpen}
        autoHideDuration={4000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        TransitionComponent={(props) => <Slide {...props} direction="left" />}
        TransitionProps={{ timeout: 500 }}
        classes={{ root: styles.snackbarRoot }}
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
    <Box className={styles.headerContainer}>
      <Box className={styles.headerButtonsBox}>
        <Button
          variant="contained"
          onClick={saveCombination}
          disabled={!selectedTeam || teamAlreadySaved(selectedTeam?.id)}
          size="small"
          className={styles.saveButton}
        >
          Guardar
        </Button>
        <Button
          component={Link}
          to="/appSelector"
          variant="outlined"
          size="small"
        >
          Volver
        </Button>
      </Box>
    </Box>
  );
}
