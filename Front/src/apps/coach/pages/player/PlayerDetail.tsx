import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import { usePermissions } from "../../../../shared/hooks/usePermissions";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import { createPlayerInjury } from "../../services/teamplayerService";
import styles from "./PlayerDetail.module.css";
import PlayerHeader from "./components/PlayerHeader";
import Demarcations from "./components/Demarcations";
import ContactInfo from "./components/ContactInfo";
import PhysicalInfo from "./components/PhysicalInfo";
import FamilyMembers from "./components/FamilyMembers";
import InjuryDialog from "./components/InjuryDialog";
import InjuryHistoryPanel from "./components/InjuryHistoryPanel";
import { usePlayerDetailData } from "./hooks/usePlayerDetailData";
import { usePlayerSave } from "./hooks/usePlayerSave";
import { usePlayerMatchHistory } from "./hooks/usePlayerMatchHistory";

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

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { teamTitleNode } = useTeamAndClub();
  const locationState = location.state as { editing?: boolean; from?: string; fromState?: unknown } | null;
  const { role, loading: loadingPermissions } = usePermissions();
  const canEdit = role === "Coach" || role === "Administrator";
  const [editing, setEditingState] = useState(locationState?.editing === true);
  const setEditing: typeof setEditingState = (value) => {
    setEditingState((prev) => {
      const next = typeof value === "function" ? (value as (s: boolean) => boolean)(prev) : value;
      return canEdit ? next : false;
    });
  };

  // Once the role resolves, force-exit edit mode for restricted roles (Player /
  // FamilyMember) even if it was entered via location.state (e.g. from IdealLineup).
  useEffect(() => {
    if (!loadingPermissions && !canEdit) {
      setEditingState(false);
    }
  }, [loadingPermissions, canEdit]);
  const handleBack = () => {
    if (locationState?.from) navigate(locationState.from, { state: locationState.fromState ?? null });
    else navigate(-1);
  };
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );
  const [injuryCreateOpen, setInjuryCreateOpen] = useState(false);
  const [savingInjury, setSavingInjury] = useState(false);
  const [injuryRefreshKey, setInjuryRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const {
    teamPlayer,
    setTeamPlayer,
    form,
    setForm,
    photo,
    setPhoto,
    demarcationOptions,
  } = usePlayerDetailData(id, DOMINANT_FOOT_MAP);

  const notify = useCallback((message: string, severity: "success" | "error") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const { saving, handleSave } = usePlayerSave({
    teamPlayer,
    form,
    demarcationOptions,
    setTeamPlayer,
    setEditing,
    notify,
  });

  const { matchHistory, loadingHistory, loadHistory } = usePlayerMatchHistory();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={teamTitleNode}
        subtitle={"Ficha detallada del jugador"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => handleBack()}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {teamPlayer && canEdit && (
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
                    loadHistory(id);
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
                      {canEdit && (
                        <Button
                          startIcon={<MedicalServicesIcon />}
                          onClick={() => setInjuryCreateOpen(true)}
                          variant="outlined"
                          color="inherit"
                          size="small"
                        >
                          Registrar lesión
                        </Button>
                      )}
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
