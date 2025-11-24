import React, { useState } from "react";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import SavedConfigs from "../../components/ui/SavedConfigs/SavedConfigs";
import CompetitionSelector from "../../components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../components/ui/GroupSelector/GroupSelector";
import TeamsSelector from "../../components/ui/TeamsSelector/TeamsSelector";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert, { AlertProps } from "@mui/material/Alert";

const STORAGE_KEY = "rffm.saved_combinations_v1";
const STORAGE_PRIMARY = "rffm.primary_combination_id";

export default function SavedConfigsPage(): JSX.Element {
  const [selectedCompetition, setSelectedCompetition] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  const [selectedGroup, setSelectedGroup] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  const [selectedTeam, setSelectedTeam] = useState<
    { id: string; name: string } | undefined
  >(undefined);

  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");

  const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref
  ) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  });

  function teamAlreadySaved(teamId: string | undefined) {
    if (!teamId) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return (
        Array.isArray(arr) &&
        arr.some((s: any) => String(s.team?.id ?? "") === String(teamId))
      );
    } catch (e) {
      return false;
    }
  }

  function persist(list: any[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event("rffm.saved_combinations_changed"));
    } catch (e) {
      // ignore
    }
  }

  function saveCombination() {
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
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const isFirst = !Array.isArray(arr) || arr.length === 0;
      const combo = {
        id,
        competition: selectedCompetition ?? null,
        group: selectedGroup ?? null,
        team: selectedTeam ?? null,
        createdAt: Date.now(),
        isPrimary: isFirst,
      };
      const next = [combo, ...(Array.isArray(arr) ? arr : [])];
      persist(next);
      if (isFirst) {
        try {
          localStorage.setItem(STORAGE_PRIMARY, id);
        } catch (e) {}
        try {
          localStorage.setItem("rffm.current_selection", JSON.stringify(combo));
          window.dispatchEvent(new Event("rffm.current_selection_changed"));
        } catch (e) {}
      }
      setSnackMsg("Combinación guardada correctamente.");
      setSnackOpen(true);
    } catch (e) {
      setSnackMsg("Error al guardar la combinación.");
      setSnackOpen(true);
    }
  }

  return (
    <BaseLayout>
      <Box>
        <Typography variant="h5">Combinaciones guardadas</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Crea y gestiona combinaciones de competición / grupo / equipo para
          poder seleccionarlas rápidamente.
        </Typography>

        <Box sx={{ mt: 2 }}>
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
          <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
            <Button variant="contained" onClick={saveCombination}>
              Guardar combinación
            </Button>
          </Box>
        </Box>

        <Box sx={{ mt: 3 }}>
          <SavedConfigs />
        </Box>
      </Box>

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
