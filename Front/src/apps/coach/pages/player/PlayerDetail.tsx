import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Stack,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  FormControl,
  InputLabel,
  Slide,
  Snackbar,
  Alert,
  Tab,
  Tabs,
  Badge,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import playerService from "../../services/playerService";
import teamplayerService from "../../services/teamplayerService";
import { createPlayerInjury } from "../../services/teamplayerService";
import demarcationService, {
  DemarcationOption,
} from "../../services/demarcationService";
import { getPlayerMatchHistory } from "../../services/liveMatchService";
import type { PlayerMatchRecord } from "../convocations/components/simulation/liveMatch.types";
import styles from "./PlayerDetail.module.css";
import PlayerHeader from "./components/PlayerHeader";
import Demarcations from "./components/Demarcations";
import ContactInfo from "./components/ContactInfo";
import PhysicalInfo from "./components/PhysicalInfo";
import FamilyMembers from "./components/FamilyMembers";
import InjuryDialog from "./components/InjuryDialog";
import InjuryHistoryPanel from "./components/InjuryHistoryPanel";

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { team, teamTitleNode } = useTeamAndClub();
  const [teamPlayer, setTeamPlayer] = useState<any | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );
  const [injuryCreateOpen, setInjuryCreateOpen] = useState(false);
  const [savingInjury, setSavingInjury] = useState(false);
  const [injuryRefreshKey, setInjuryRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [matchHistory, setMatchHistory] = useState<PlayerMatchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [demarcationOptions, setDemarcationOptions] = useState<
    DemarcationOption[]
  >([]);
  const DOMINANT_FOOT_MAP: Record<string, number> = {
    Zurdo: 1,
    Diestro: 2,
    Ambidiestro: 3,
  };
  const DOMINANT_FOOT_ID_TO_NAME: Record<number, string> = {
    1: "Zurdo",
    2: "Diestro",
    3: "Ambidiestro",
  };

  const handleSave = async () => {
    if (!teamPlayer) return;

    const possibleNames = (form.possibleDemarcations ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const nameToId = new Map<string, number>();
    demarcationOptions.forEach((o) => nameToId.set(o.name, o.id));
    const mapped: Array<number | undefined> = possibleNames.map((n: string) =>
      nameToId.get(n)
    );
    const possibleIds: number[] = mapped.filter(
      (x): x is number => x !== undefined
    );

    if (possibleIds.length > 0 && !(form.activePositionId ?? null)) {
      setSnackbarMessage(
        "Seleccione la demarcación habitual antes de guardar."
      );
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    setSaving(true);
    try {
      const parseNumber = (v: any) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const payload: any = {
        dorsal: parseNumber(form.dorsal),
        playerInfo: {
          name: form.name ?? null,
          lastName: form.lastName ?? null,
          alias: form.alias ?? null,
          urlPhoto: form.urlPhoto ?? null,
        },
        demarcation: {
          activePositionId: form.activePositionId ?? null,
          activePositionName: form.activePositionName ?? null,
          possibleDemarcations: possibleIds,
        },
        contactInfo: {
          phone: form.phone ?? null,
          email: form.email ?? null,
        },
        physicalInfo: {
          height: parseNumber(form.height),
          weight: parseNumber(form.weight),
          dominantFoot: form.dominantFoot ?? null,
          dominantFootId: form.dominantFootId ?? null,
        },
      };
      const updated = await teamplayerService.updateTeamPlayer(
        teamPlayer.id,
        payload
      );
      if (updated) {
        setTeamPlayer(updated);
        setEditing(false);
        setSnackbarMessage("Jugador guardado correctamente.");
        setSnackbarSeverity("success");
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage("No se pudo guardar el jugador.");
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
      }
    } catch (e) {
      setSnackbarMessage("Error al guardar. Inténtelo de nuevo.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      // load demarcation options for id<->name mapping
      try {
        const opts = await demarcationService.getDemarcations();
        if (mounted) setDemarcationOptions(opts);
      } catch (e) {}

      if (!id) return;
      try {
        const tp = await teamplayerService.getTeamPlayerById(id);
        if (!mounted) return;
        if (tp) {
          setTeamPlayer(tp);
          setForm({
            alias: tp.player?.alias ?? "",
            name: tp.player?.name ?? "",
            lastName: tp.player?.lastName ?? "",
            dorsal: tp.dorsal ?? null,
            phone: tp.contactInfo?.phone ?? "",
            email: tp.contactInfo?.email ?? "",
            height: tp.physicalInfo?.height ?? null,
            weight: tp.physicalInfo?.weight ?? null,
            dominantFoot: tp.physicalInfo?.dominantFoot ?? "",
            dominantFootId: tp.physicalInfo?.dominantFoot
              ? DOMINANT_FOOT_MAP[tp.physicalInfo?.dominantFoot] ?? null
              : null,
            activePositionName: tp.demarcation?.activePositionName ?? "",
            activePositionId: tp.demarcation?.activePositionId ?? null,
            possibleDemarcations: (
              tp.demarcation?.possibleDemarcations ?? []
            ).join(", "),
            urlPhoto: tp.player?.urlPhoto ?? tp.player?.photoUrl ?? null,
          });
          const photoUrl = tp.player?.urlPhoto ?? tp.player?.photoUrl ?? null;
          if (photoUrl) {
            try {
              const obj = await playerService.fetchPlayerPhoto(photoUrl);
              if (!mounted) return;
              setPhoto(obj);
            } catch (e) {}
          }
          return;
        }

        const p = await playerService.getPlayerById(id as string);
        if (!mounted) return;
        if (p) {
          setTeamPlayer({ player: p });
          setForm({
            alias: p?.alias ?? "",
            name: p?.name ?? "",
            lastName: p?.lastName ?? "",
            dorsal: null,
            phone: "",
            email: "",
            height: null,
            weight: null,
            dominantFoot: "",
            dominantFootId: null,
            activePositionName: "",
            activePositionId: null,
            possibleDemarcations: "",
            urlPhoto: p?.urlPhoto ?? null,
          });
          if (p?.urlPhoto) {
            try {
              const obj = await playerService.fetchPlayerPhoto(p.urlPhoto);
              if (!mounted) return;
              setPhoto(obj);
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
    load();
    return () => {
      mounted = false;
      if (photo) {
        try {
          URL.revokeObjectURL(photo);
        } catch (e) {}
      }
    };
  }, [id]);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode}
        subtitle={"Ficha detallada del jugador"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {teamPlayer && (
              <>
                <Button
                  onClick={() => setEditing((s) => !s)}
                  variant={editing ? "outlined" : "contained"}
                  size="small"
                >
                  {editing ? "Cancelar" : "Editar"}
                </Button>
                {editing && (
                  <>
                    <Button
                      onClick={handleSave}
                      variant="contained"
                      size="small"
                      disabled={saving}
                    >
                      Guardar
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        }
      >
        <Box className={styles.page}>
          {!teamPlayer && <div>Cargando...</div>}
          {teamPlayer && (
            <>
              <PlayerHeader
                teamPlayer={teamPlayer}
                photo={photo}
                editing={editing}
                form={form}
                setForm={(f: any) => setForm(f)}
                setPhoto={(s: string | null) => setPhoto(s)}
                onNotify={(msg: string, sev: "success" | "error") => {
                  setSnackbarMessage(msg);
                  setSnackbarSeverity(sev);
                  setSnackbarOpen(true);
                }}
              />
              <div className={styles.tabsWrap}>
                <Tabs
                  value={activeTab}
                  onChange={(_, v) => setActiveTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    "& .MuiTab-root": {
                      color: "var(--rffm-muted, #a59f9f)",
                      minWidth: 0,
                      fontSize: 13,
                      textTransform: "none",
                      px: 2,
                    },
                    "& .Mui-selected": { color: "var(--rffm-accent, #f97316) !important" },
                    "& .MuiTabs-indicator": { backgroundColor: "var(--rffm-accent, #f97316)" },
                  }}
                >
                  <Tab label="Demarcación" />
                  <Tab label="Contacto" />
                  <Tab label="Físico" />
                  <Tab label="Familia" />
                  <Tab
                    label={
                      <Badge
                        variant="dot"
                        color="error"
                        invisible={!teamPlayer?.injuryInfo}
                        sx={{ "& .MuiBadge-dot": { top: 4, right: -6 } }}
                      >
                        Lesiones
                      </Badge>
                    }
                  />
                  <Tab label="Estadísticas" onClick={() => {
                    if (!historyLoaded && id) {
                      setLoadingHistory(true);
                      getPlayerMatchHistory(id)
                        .then((data) => { setMatchHistory(data); setHistoryLoaded(true); })
                        .catch(() => {})
                        .finally(() => setLoadingHistory(false));
                    }
                  }} />
                </Tabs>
              </div>

              <div className={styles.tabPanel}>
                {activeTab === 0 && (
                  <Demarcations
                    teamPlayer={teamPlayer}
                    editing={editing}
                    value={(form.possibleDemarcations ?? "")
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter((s: string) => s.length > 0)}
                    active={form.activePositionName ?? null}
                    onChange={(ids: number[]) => {
                      const idToName = new Map<number, string>();
                      demarcationOptions.forEach((o) => idToName.set(o.id, o.name));
                      const names = ids
                        .map((i) => idToName.get(i))
                        .filter((n) => n) as string[];
                      setForm({ ...form, possibleDemarcations: names.join(", ") });
                    }}
                    onActiveChange={(id: number | null) => {
                      const found = demarcationOptions.find((o) => o.id === id);
                      setForm({
                        ...form,
                        activePositionId: id,
                        activePositionName: found?.name ?? "",
                      });
                    }}
                  />
                )}

                {activeTab === 1 && (
                  !editing ? (
                    <ContactInfo teamPlayer={teamPlayer} />
                  ) : (
                    <div className={styles.card}>
                      <div className={styles.sectionInner}>
                        <h3>Información de contacto</h3>
                        <TextField
                          label="Teléfono"
                          size="small"
                          fullWidth
                          value={form.phone ?? ""}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                        <div style={{ height: 8 }} />
                        <TextField
                          label="Email"
                          size="small"
                          fullWidth
                          value={form.email ?? ""}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                    </div>
                  )
                )}

                {activeTab === 2 && (
                  !editing ? (
                    <PhysicalInfo teamPlayer={teamPlayer} />
                  ) : (
                    <div className={styles.card}>
                      <div className={styles.sectionInner}>
                        <h3>Datos físicos</h3>
                        <TextField
                          label="Altura"
                          size="small"
                          fullWidth
                          type="number"
                          inputProps={{ min: 50, max: 250, step: 1, inputMode: "numeric" }}
                          value={form.height ?? ""}
                          onChange={(e) => setForm({ ...form, height: e.target.value })}
                          onKeyDown={(e) => {
                            const blocked = ["e", "E", "+", "-", ","];
                            if (blocked.includes(e.key)) e.preventDefault();
                          }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">cm</InputAdornment>,
                          }}
                        />
                        <div style={{ height: 8 }} />
                        <TextField
                          label="Peso"
                          size="small"
                          fullWidth
                          type="number"
                          inputProps={{ min: 10, max: 200, step: 0.1, inputMode: "decimal" }}
                          value={form.weight ?? ""}
                          onChange={(e) => setForm({ ...form, weight: e.target.value })}
                          onKeyDown={(e) => {
                            const blocked = ["e", "E", "+", "-", ","];
                            if (blocked.includes(e.key)) e.preventDefault();
                          }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">kg</InputAdornment>,
                          }}
                        />
                        <div style={{ height: 8 }} />
                        <FormControl fullWidth size="small">
                          <InputLabel id="dominant-foot-label">Pie</InputLabel>
                          <Select
                            labelId="dominant-foot-label"
                            label="Pie"
                            value={form.dominantFootId ?? ""}
                            size="small"
                            onChange={(e) => {
                              const id = Number((e.target as HTMLSelectElement).value);
                              setForm({
                                ...form,
                                dominantFootId: isNaN(id) ? null : id,
                                dominantFoot: isNaN(id) ? "" : DOMINANT_FOOT_ID_TO_NAME[id],
                              });
                            }}
                          >
                            <MenuItem value={1}>Zurdo</MenuItem>
                            <MenuItem value={2}>Diestro</MenuItem>
                            <MenuItem value={3}>Ambidiestro</MenuItem>
                          </Select>
                        </FormControl>
                      </div>
                    </div>
                  )
                )}

                {activeTab === 3 && <FamilyMembers teamPlayer={teamPlayer} />}

                {activeTab === 4 && (
                  <>
                    <div className={styles.injuryActions}>
                      <Button
                        startIcon={<MedicalServicesIcon />}
                        onClick={() => setInjuryCreateOpen(true)}
                        variant="outlined"
                        color="inherit"
                        size="small"
                      >
                        Registrar lesión
                      </Button>
                    </div>
                    <InjuryHistoryPanel
                      teamPlayerId={teamPlayer.id}
                      refreshKey={injuryRefreshKey}
                      onActiveInjuryChange={(inj) =>
                        setTeamPlayer({ ...teamPlayer, injuryInfo: inj })
                      }
                    />
                  </>
                )}

                {activeTab === 5 && (
                  <div className={styles.statsTab}>
                    {loadingHistory && (
                      <div className={styles.statsLoading}>
                        <CircularProgress size={24} />
                      </div>
                    )}
                    {!loadingHistory && matchHistory.length === 0 && (
                      <p className={styles.statsEmpty}>No hay partidos registrados.</p>
                    )}
                    {!loadingHistory && matchHistory.length > 0 && (() => {
                      const totalMinutes = matchHistory.reduce((s, r) => s + r.minutesPlayed, 0);
                      const totalGoals = matchHistory.reduce((s, r) => s + r.goalsScored, 0);
                      const totalStarts = matchHistory.filter((r) => r.isStarter).length;
                      return (
                        <>
                          <div className={styles.statsTotals}>
                            <div className={styles.statsTotalItem}>
                              <span className={styles.statsTotalValue}>{totalMinutes}</span>
                              <span className={styles.statsTotalLabel}>minutos</span>
                            </div>
                            <div className={styles.statsTotalItem}>
                              <span className={styles.statsTotalValue}>{totalGoals}</span>
                              <span className={styles.statsTotalLabel}>goles</span>
                            </div>
                            <div className={styles.statsTotalItem}>
                              <span className={styles.statsTotalValue}>{totalStarts}</span>
                              <span className={styles.statsTotalLabel}>titularidades</span>
                            </div>
                            <div className={styles.statsTotalItem}>
                              <span className={styles.statsTotalValue}>{matchHistory.length}</span>
                              <span className={styles.statsTotalLabel}>partidos</span>
                            </div>
                          </div>
                          <div className={styles.statsTableWrapper}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Fecha guardado</TableCell>
                                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Marcador</TableCell>
                                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Min</TableCell>
                                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Titular</TableCell>
                                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Entró</TableCell>
                                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Salió</TableCell>
                                  <TableCell sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Goles</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {matchHistory.map((r) => (
                                  <TableRow key={r.eventId}>
                                    <TableCell sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
                                      {new Date(r.savedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                    </TableCell>
                                    <TableCell sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
                                      {r.scoreLocal}:{r.scoreVisitor}
                                    </TableCell>
                                    <TableCell sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>{r.minutesPlayed}</TableCell>
                                    <TableCell sx={{ color: r.isStarter ? "#22c55e" : "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                                      {r.isStarter ? "Sí" : "No"}
                                    </TableCell>
                                    <TableCell sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
                                      {r.enteredAtMinute != null ? `${r.enteredAtMinute}'` : "—"}
                                    </TableCell>
                                    <TableCell sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
                                      {r.exitedAtMinute != null ? `${r.exitedAtMinute}'` : "—"}
                                    </TableCell>
                                    <TableCell sx={{ color: r.goalsScored > 0 ? "#fb923c" : "rgba(255,255,255,0.4)", fontSize: "0.8rem", fontWeight: r.goalsScored > 0 ? 700 : 400 }}>
                                      {r.goalsScored}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
        </Box>
        <InjuryDialog
          open={injuryCreateOpen}
          current={null}
          saving={savingInjury}
          onClose={() => setInjuryCreateOpen(false)}
          onSave={async (data) => {
            if (!teamPlayer) return;
            setSavingInjury(true);
            const result = await createPlayerInjury(teamPlayer.id, {
              ...data,
              startDate: new Date(data.startDate).toISOString(),
            });
            setSavingInjury(false);
            if (result) {
              setTeamPlayer({ ...teamPlayer, injuryInfo: result });
              setInjuryCreateOpen(false);
              setInjuryRefreshKey((k) => k + 1);
              setSnackbarMessage("Lesión registrada correctamente.");
              setSnackbarSeverity("success");
              setSnackbarOpen(true);
            } else {
              setSnackbarMessage("No se pudo guardar la lesión.");
              setSnackbarSeverity("error");
              setSnackbarOpen(true);
            }
          }}
        />
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          TransitionComponent={(props) => <Slide {...props} direction="up" />}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarSeverity}
            sx={{ width: "100%" }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </ContentLayout>
    </BaseLayout>
  );
}
