import React from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import styles from "./StatsControls.module.css";
import {
  getCompetitions,
  getGroups,
  getTeamsForClassification,
  getSettingsForUser,
} from "../../../../apps/federation/services/api";
import { useUser } from "../../../context/UserContext";

type Option = { id: string; name: string };

export default function StatsControls({
  onCompare,
}: {
  onCompare: (opts: {
    competitionId: string;
    groupId: string;
    team1: string;
    team2: string;
  }) => void;
}) {
  const [competitions, setCompetitions] = React.useState<Option[]>([]);
  const [groups, setGroups] = React.useState<Option[]>([]);
  const [teams, setTeams] = React.useState<Option[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [competitionId, setCompetitionId] = React.useState("");
  const [groupId, setGroupId] = React.useState("");
  const [team1, setTeam1] = React.useState("");
  const [team2, setTeam2] = React.useState("");
  const { user } = useUser();

  React.useEffect(() => {
    let mounted = true;
    getCompetitions().then((res: any) => {
      if (!mounted) return;
      const opts = (res || []).map((c: any) => ({
        id: String(c.id ?? c.competitionId ?? c.code ?? c.value ?? ""),
        name: c.name ?? c.competitionName ?? c.label ?? String(c),
      }));
      setCompetitions(opts);
    });
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    async function loadFromApi() {
      if (!user?.id) return;
      try {
        const settings = await getSettingsForUser(user.id);
        if (Array.isArray(settings) && settings.length > 0) {
          const primaryId =
            settings.find((s: any) => s.isPrimary) || settings[0];
          if (primaryId) {
            if (primaryId.competitionId || primaryId.competition?.id)
              setCompetitionId(
                String(primaryId.competitionId || primaryId.competition?.id)
              );
            if (primaryId.groupId || primaryId.group?.id)
              setGroupId(String(primaryId.groupId || primaryId.group?.id));
          }
        }
      } catch (e) {
        // ignore
      }
    }

    loadFromApi();
    function onSaved() {
      loadFromApi();
    }
    window.addEventListener("rffm.saved_combinations_changed", onSaved);
    return () =>
      window.removeEventListener("rffm.saved_combinations_changed", onSaved);
  }, [user]);

  React.useEffect(() => {
    if (!competitionId) return;
    let mounted = true;
    getGroups(competitionId).then((res: any) => {
      if (!mounted) return;
      const opts = (res || []).map((g: any) => ({
        id: String(g.id ?? g.groupId ?? g.code ?? ""),
        name: g.name ?? g.groupName ?? String(g),
      }));
      setGroups(opts);
    });
    return () => {
      mounted = false;
    };
  }, [competitionId]);

  React.useEffect(() => {
    if (!competitionId || !groupId) return;
    setLoading(true);
    let mounted = true;
    getTeamsForClassification({ competition: competitionId, group: groupId })
      .then((res: any) => {
        if (!mounted) return;
        const opts = (res || []).map((t: any) => ({
          id: String(t.teamId ?? t.teamId ?? t.teamId ?? ""),
          name: t.teamName ?? t.nombre ?? String(t),
        }));
        setTeams(opts);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [competitionId, groupId]);

  function compare() {
    if (!competitionId || !groupId || !team1 || !team2) return;
    onCompare({ competitionId, groupId, team1, team2 });
  }

  return (
    <Box className={styles.root}>
      <Grid container spacing={1} alignItems="center">
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Competición</InputLabel>
            <Select
              value={competitionId}
              label="Competición"
              onChange={(e) => {
                setCompetitionId(String(e.target.value));
                setGroupId("");
                setTeam1("");
                setTeam2("");
              }}
            >
              <MenuItem value="">-- Seleccionar --</MenuItem>
              {competitions.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Grupo</InputLabel>
            <Select
              value={groupId}
              label="Grupo"
              onChange={(e) => {
                setGroupId(String(e.target.value));
                setTeam1("");
                setTeam2("");
              }}
            >
              <MenuItem value="">-- Seleccionar --</MenuItem>
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Equipo 1</InputLabel>
            <Select
              value={team1}
              label="Equipo 1"
              onChange={(e) => setTeam1(String(e.target.value))}
            >
              <MenuItem value="">-- Seleccionar --</MenuItem>
              {teams.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Equipo 2</InputLabel>
            <Select
              value={team2}
              label="Equipo 2"
              onChange={(e) => setTeam2(String(e.target.value))}
            >
              <MenuItem value="">-- Seleccionar --</MenuItem>
              {teams.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={12} style={{ textAlign: "right" }}>
          <Button
            variant="contained"
            onClick={compare}
            disabled={loading || !competitionId || !groupId || !team1 || !team2}
          >
            {loading ? <CircularProgress size={18} /> : "Comparar"}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
