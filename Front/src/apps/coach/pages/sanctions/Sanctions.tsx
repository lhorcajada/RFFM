import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import teamplayerService from "../../services/teamplayerService";
import teamplayerSanctionService, {
  getTeamSanctions,
  createPlayerSanction,
  updatePlayerSanction,
  deletePlayerSanction,
} from "../../services/teamplayerSanctionService";
import type {
  SanctionCategory,
  SanctionRecord,
  SportivePunishmentType,
} from "../../services/teamplayerSanctionService";
import type { PlayerResponse } from "../../services/teamplayerService";
import { getSportEvents } from "../../services/sportEventService";
import type { SportEventResponse } from "../../services/sportEventService";
import { coachAuthService } from "../../services/authService";
import styles from "./Sanctions.module.css";

type SanctionRow = { player: PlayerResponse; sanction: SanctionRecord };

const CATEGORY_OPTIONS: { value: SanctionCategory; label: string }[] = [
  { value: "Competition", label: "Deportiva (reglamento de competición)" },
  { value: "InternalDiscipline", label: "Comportamiento (decisión interna)" },
];

const PUNISHMENT_TYPE_OPTIONS: { value: "" | SportivePunishmentType; label: string }[] = [
  { value: "", label: "Ninguno" },
  { value: "Deconvocation", label: "Desconvocatoria" },
  { value: "MinutesLimit", label: "Límite de minutos" },
];

/** Derives the display status from the backend's computed `status` when present,
 * falling back to the legacy endDate-based inference (design.md Decisión 3). */
function getStatus(sanction: SanctionRecord): "Pending" | "Fulfilled" {
  return sanction.status ?? (sanction.endDate ? "Fulfilled" : "Pending");
}

function eventDateValue(ev: SportEventResponse | undefined | null): string | null {
  if (!ev) return null;
  return ev.eveDateTime ?? ev.startTime ?? ev.start ?? null;
}

function eventLabel(ev: SportEventResponse): string {
  const name = ev.name ?? ev.title ?? "Partido";
  const dateStr = eventDateValue(ev);
  const date = dateStr ? new Date(dateStr).toLocaleDateString("es-ES") : "";
  return date ? `${name} · ${date}` : name;
}

export default function Sanctions() {
  const navigate = useNavigate();
  const { team, teamTitleNode } = useTeamAndClub();

  const _roles = coachAuthService.getRoles();
  const isPlayerOrFamily =
    (_roles.includes("Player") || _roles.includes("FamilyPlayer") || _roles.includes("FamilyMember")) &&
    !_roles.includes("Coach") &&
    !_roles.includes("Administrator");

  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [rows, setRows] = useState<SanctionRow[]>([]);
  const [events, setEvents] = useState<SportEventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  function isTargetEventInFuture(eventId: string | null | undefined): boolean {
    if (!eventId) return false;
    const dateStr = eventDateValue(eventsById.get(eventId));
    if (!dateStr) return false;
    return new Date(dateStr).getTime() > Date.now();
  }

  function canDeleteSanction(sanction: SanctionRecord): boolean {
    if (getStatus(sanction) !== "Fulfilled") return true;
    if (sanction.sportivePunishmentType !== "Deconvocation") return false;
    return isTargetEventInFuture(sanction.targetEventId);
  }

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addPlayer, setAddPlayer] = useState<PlayerResponse | null>(null);
  const [addCategory, setAddCategory] = useState<SanctionCategory>("InternalDiscipline");
  const [addStartDate, setAddStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [addSanctionType, setAddSanctionType] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addEstimatedEnd, setAddEstimatedEnd] = useState("");
  const [addFine, setAddFine] = useState("");
  const [addAmountPaid, setAddAmountPaid] = useState("");
  const [addPunishmentType, setAddPunishmentType] = useState<"" | SportivePunishmentType>("");
  const [addTargetEventId, setAddTargetEventId] = useState("");
  const [addMinutesLimit, setAddMinutesLimit] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<SanctionRow | null>(null);
  const [editCategory, setEditCategory] = useState<SanctionCategory>("InternalDiscipline");
  const [editAmountPaid, setEditAmountPaid] = useState("");
  const [editPunishmentType, setEditPunishmentType] = useState<"" | SportivePunishmentType>("");
  const [editTargetEventId, setEditTargetEventId] = useState("");
  const [editMinutesLimit, setEditMinutesLimit] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!team) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      teamplayerService.getPlayersByTeam(team.id),
      getTeamSanctions(team.id),
      getSportEvents(team.id, 1, 200, undefined, undefined, false).catch(() => ({ items: [] })),
    ])
      .then(([list, teamSanctions, sportEvents]) => {
        if (!mounted) return;
        setPlayers(list);
        setEvents(sportEvents.items ?? []);
        const sanctionsByPlayer = new Map(
          teamSanctions.map(({ teamPlayerId, sanctions }) => [teamPlayerId, sanctions])
        );
        const allRows: SanctionRow[] = [];
        for (const player of list) {
          for (const sanction of sanctionsByPlayer.get(player.id) ?? []) {
            allRows.push({ player, sanction });
          }
        }
        allRows.sort((a, b) => new Date(b.sanction.startDate).getTime() - new Date(a.sanction.startDate).getTime());
        setRows(allRows);
      })
      .catch(() => {
        if (mounted) { setPlayers([]); setRows([]); setEvents([]); }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [team, refreshKey]);

  function openAdd() {
    setAddPlayer(null);
    setAddCategory("InternalDiscipline");
    setAddStartDate(new Date().toISOString().slice(0, 10));
    setAddSanctionType("");
    setAddDescription("");
    setAddEstimatedEnd("");
    setAddFine("");
    setAddAmountPaid("");
    setAddPunishmentType("");
    setAddTargetEventId("");
    setAddMinutesLimit("");
    setAddOpen(true);
  }

  async function handleAddSave() {
    if (isPlayerOrFamily) return;
    if (!addPlayer || !addSanctionType.trim() || !addStartDate) return;
    if (addPunishmentType && !addTargetEventId) return;
    if (addPunishmentType === "MinutesLimit" && !addMinutesLimit.trim()) return;

    setAddSaving(true);
    const result = await createPlayerSanction(addPlayer.id, {
      category: addCategory,
      startDate: addStartDate,
      sanctionType: addSanctionType,
      description: addDescription || null,
      estimatedEnd: addEstimatedEnd || null,
      fine: addFine.trim() ? Number(addFine) : null,
      amountPaid: addAmountPaid.trim() ? Number(addAmountPaid) : null,
      sportivePunishmentType: addPunishmentType || null,
      targetEventId: addPunishmentType ? addTargetEventId : null,
      minutesLimit: addPunishmentType === "MinutesLimit" ? Number(addMinutesLimit) : null,
    });
    setAddSaving(false);
    if (result) {
      setAddOpen(false);
      setRefreshKey((k) => k + 1);
    }
  }

  function openEdit(row: SanctionRow) {
    setEditRow(row);
    setEditCategory(row.sanction.category ?? "InternalDiscipline");
    setEditAmountPaid(row.sanction.amountPaid != null ? String(row.sanction.amountPaid) : "");
    setEditPunishmentType(row.sanction.sportivePunishmentType ?? "");
    setEditTargetEventId(row.sanction.targetEventId ?? "");
    setEditMinutesLimit(row.sanction.minutesLimit != null ? String(row.sanction.minutesLimit) : "");
    setEditOpen(true);
  }

  async function handleEditSave(data: {
    startDate: string;
    sanctionType: string;
    description?: string | null;
    estimatedEnd?: string | null;
    endDate?: string | null;
    fine?: number | null;
  }) {
    if (isPlayerOrFamily) return;
    if (!editRow) return;
    setEditSaving(true);
    await updatePlayerSanction(editRow.player.id, editRow.sanction.id, {
      ...data,
      endDate: data.endDate || null,
      category: editCategory,
      amountPaid: editAmountPaid.trim() ? Number(editAmountPaid) : null,
      sportivePunishmentType: editPunishmentType || null,
      targetEventId: editPunishmentType ? editTargetEventId : null,
      minutesLimit: editPunishmentType === "MinutesLimit" ? (editMinutesLimit.trim() ? Number(editMinutesLimit) : null) : null,
    });
    setEditSaving(false);
    setEditOpen(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleLift(row: SanctionRow) {
    if (isPlayerOrFamily) return;
    const name = ((row.player.name ?? "") + " " + (row.player.lastName ?? "")).trim() || row.player.alias;
    if (!confirm(`¿Levantar sanción a ${name}?`)) return;
    await updatePlayerSanction(row.player.id, row.sanction.id, {
      category: row.sanction.category ?? "InternalDiscipline",
      startDate: row.sanction.startDate,
      sanctionType: row.sanction.sanctionType,
      description: row.sanction.description,
      estimatedEnd: row.sanction.estimatedEnd,
      endDate: new Date().toISOString(),
      fine: row.sanction.fine,
      amountPaid: row.sanction.amountPaid ?? null,
      sportivePunishmentType: row.sanction.sportivePunishmentType ?? null,
      targetEventId: row.sanction.targetEventId ?? null,
      minutesLimit: row.sanction.minutesLimit ?? null,
    });
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(row: SanctionRow) {
    if (isPlayerOrFamily) return;
    if (!canDeleteSanction(row.sanction)) return;
    const name = ((row.player.name ?? "") + " " + (row.player.lastName ?? "")).trim() || row.player.alias;
    if (!confirm(`¿Eliminar la sanción de ${name}?`)) return;
    const ok = await deletePlayerSanction(row.player.id, row.sanction.id);
    if (!ok) {
      window.dispatchEvent(
        new CustomEvent("rffm.show_snackbar", {
          detail: { message: "No se puede eliminar una sanción ya cumplida.", severity: "error" },
        })
      );
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  const canAdd =
    !!addPlayer &&
    addSanctionType.trim().length > 0 &&
    addStartDate.length > 0 &&
    (!addPunishmentType || !!addTargetEventId) &&
    (addPunishmentType !== "MinutesLimit" || addMinutesLimit.trim().length > 0);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Sanciones"
        subtitle={teamTitleNode ?? "Registro de sanciones a jugadores"}
        actionBar={
          <Stack direction="row" spacing={1} alignItems="center">
            {!isPlayerOrFamily && (
              <Button startIcon={<AddIcon />} onClick={openAdd} variant="contained" size="small" color="warning" disabled={players.length === 0}>
                Añadir sanción
              </Button>
            )}
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/coach/dashboard")} variant="outlined" size="small">
              Volver
            </Button>
          </Stack>
        }
      >
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={32} />
          </Stack>
        ) : rows.length === 0 ? (
          <EmptyState title="Sin sanciones" description="No hay sanciones registradas actualmente." />
        ) : (
          <TableContainer className={styles.tableCard}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Jugador</TableCell>
                  <TableCell>Sanción</TableCell>
                  <TableCell>Inicio</TableCell>
                  <TableCell>Fin</TableCell>
                  <TableCell>Multa</TableCell>
                  <TableCell>Pagado</TableCell>
                  <TableCell>Pendiente</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ player, sanction }) => {
                  const status = getStatus(sanction);
                  const isPending = status === "Pending";
                  const deletable = canDeleteSanction(sanction);
                  const pendingAmount =
                    sanction.pendingAmount != null
                      ? sanction.pendingAmount
                      : sanction.fine != null
                        ? sanction.fine - (sanction.amountPaid ?? 0)
                        : null;
                  return (
                    <TableRow key={sanction.id} hover>
                      <TableCell>
                        <div className={styles.playerCell}>
                          <span className={styles.playerName}>{((player.name ?? "") + " " + (player.lastName ?? "")).trim() || player.alias}</span>
                          {player.alias && <span className={styles.playerMeta}>{player.alias}{player.dorsal != null ? ` · #${player.dorsal}` : ""}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Typography variant="body2">{sanction.sanctionType}</Typography>
                          {sanction.isAutomatic && (
                            <Chip label="Automática" size="small" color="warning" variant="outlined" />
                          )}
                          {sanction.sportivePunishmentType === "Deconvocation" && (
                            <Chip label="Desconvocatoria" size="small" color="error" variant="outlined" />
                          )}
                          {sanction.sportivePunishmentType === "MinutesLimit" && (
                            <Chip
                              label={`Máx. ${sanction.minutesLimit ?? "?"}'`}
                              size="small"
                              color="info"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        {sanction.estimatedEnd && <Typography variant="caption" color="text.secondary">Fin estimado: {sanction.estimatedEnd}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{new Date(sanction.startDate).toLocaleDateString("es-ES")}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{sanction.endDate ? new Date(sanction.endDate).toLocaleDateString("es-ES") : "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{sanction.fine != null ? `${sanction.fine} €` : "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{sanction.amountPaid != null ? `${sanction.amountPaid} €` : "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{pendingAmount != null ? `${pendingAmount} €` : "—"}</Typography>
                      </TableCell>
                      <TableCell>{isPending ? <Chip label="Pendiente" color="error" size="small" /> : <Chip label="Cumplida" color="success" size="small" variant="outlined" />}</TableCell>
                      <TableCell align="right">
                        <div className={styles.actions}>
                          {!isPlayerOrFamily && (
                            <Tooltip title="Editar">
                              <IconButton size="small" onClick={() => openEdit({ player, sanction })}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isPlayerOrFamily && isPending && (
                            <Tooltip title="Levantar sanción">
                              <IconButton size="small" color="success" onClick={() => handleLift({ player, sanction })}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isPlayerOrFamily && (
                            <Tooltip title={deletable ? "Eliminar" : "No se puede eliminar una sanción ya cumplida"}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={!deletable}
                                  onClick={() => handleDelete({ player, sanction })}
                                  aria-label="Eliminar"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentLayout>

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar sanción</DialogTitle>
        <DialogContent>
          <div className={styles.addDialogFields}>
            <Autocomplete options={players} getOptionLabel={(p) => ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias} value={addPlayer} onChange={(_, val) => setAddPlayer(val)} renderInput={(params) => <TextField {...params} label="Jugador" size="small" required fullWidth />} />
            <FormControl size="small" fullWidth required>
              <InputLabel id="add-category-label">Naturaleza</InputLabel>
              <Select
                labelId="add-category-label"
                label="Naturaleza"
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value as SanctionCategory)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Fecha inicio" type="date" size="small" fullWidth value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} InputLabelProps={{ shrink: true }} required />
            <TextField label="Tipo de sanción" size="small" fullWidth value={addSanctionType} onChange={(e) => setAddSanctionType(e.target.value)} placeholder="Ej: Expulsión, sanción federativa..." required />
            <TextField label="Descripción" size="small" fullWidth multiline minRows={2} value={addDescription} onChange={(e) => setAddDescription(e.target.value)} placeholder="Motivo de la sanción" />
            <TextField label="Fin estimado" size="small" fullWidth value={addEstimatedEnd} onChange={(e) => setAddEstimatedEnd(e.target.value)} placeholder="Ej: 1 partido, 2 semanas" />

            <FormControl size="small" fullWidth>
              <InputLabel id="add-punishment-label">Tipo de sanción deportiva</InputLabel>
              <Select
                labelId="add-punishment-label"
                label="Tipo de sanción deportiva"
                value={addPunishmentType}
                onChange={(e) => {
                  const val = e.target.value as "" | SportivePunishmentType;
                  setAddPunishmentType(val);
                  if (!val) { setAddTargetEventId(""); setAddMinutesLimit(""); }
                  if (val === "Deconvocation") setAddMinutesLimit("");
                }}
              >
                {PUNISHMENT_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value || "none"} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {addPunishmentType && (
              <FormControl size="small" fullWidth required>
                <InputLabel id="add-event-label">Partido</InputLabel>
                <Select
                  labelId="add-event-label"
                  label="Partido"
                  value={addTargetEventId}
                  onChange={(e) => setAddTargetEventId(e.target.value)}
                >
                  {events.map((ev) => (
                    <MenuItem key={ev.id} value={ev.id}>{eventLabel(ev)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {addPunishmentType === "MinutesLimit" && (
              <TextField
                label="Límite de minutos"
                type="number"
                size="small"
                fullWidth
                value={addMinutesLimit}
                onChange={(e) => setAddMinutesLimit(e.target.value)}
                inputProps={{ min: 1, step: 1 }}
                required
              />
            )}

            <TextField label="Multa (€)" type="number" size="small" fullWidth value={addFine} onChange={(e) => setAddFine(e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
            <TextField
              label="Importe pagado (€)"
              type="number"
              size="small"
              fullWidth
              value={addAmountPaid}
              onChange={(e) => setAddAmountPaid(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
              helperText="No puede superar la multa"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={addSaving}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddSave} disabled={!canAdd || addSaving}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog (reuses same structure) */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editar sanción</DialogTitle>
        <DialogContent>
          <div className={styles.addDialogFields}>
            <FormControl size="small" fullWidth required>
              <InputLabel id="edit-category-label">Naturaleza</InputLabel>
              <Select
                labelId="edit-category-label"
                label="Naturaleza"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as SanctionCategory)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Fecha inicio" type="date" size="small" fullWidth value={editRow?.sanction.startDate?.slice(0,10) ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, startDate: e.target.value } } : r)} InputLabelProps={{ shrink: true }} />
            <TextField label="Tipo de sanción" size="small" fullWidth value={editRow?.sanction.sanctionType ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, sanctionType: e.target.value } } : r)} disabled={editRow?.sanction.isAutomatic} helperText={editRow?.sanction.isAutomatic ? "Generada automáticamente, no editable" : undefined} />
            <TextField label="Descripción" size="small" fullWidth multiline minRows={2} value={editRow?.sanction.description ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, description: e.target.value } } : r)} />
            <TextField label="Fin estimado" size="small" fullWidth value={editRow?.sanction.estimatedEnd ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, estimatedEnd: e.target.value } } : r)} />

            <FormControl size="small" fullWidth>
              <InputLabel id="edit-punishment-label">Tipo de sanción deportiva</InputLabel>
              <Select
                labelId="edit-punishment-label"
                label="Tipo de sanción deportiva"
                value={editPunishmentType}
                onChange={(e) => {
                  const val = e.target.value as "" | SportivePunishmentType;
                  setEditPunishmentType(val);
                  if (!val) { setEditTargetEventId(""); setEditMinutesLimit(""); }
                  if (val === "Deconvocation") setEditMinutesLimit("");
                }}
              >
                {PUNISHMENT_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value || "none"} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {editPunishmentType && (
              <FormControl size="small" fullWidth required>
                <InputLabel id="edit-event-label">Partido</InputLabel>
                <Select
                  labelId="edit-event-label"
                  label="Partido"
                  value={editTargetEventId}
                  onChange={(e) => setEditTargetEventId(e.target.value)}
                >
                  {events.map((ev) => (
                    <MenuItem key={ev.id} value={ev.id}>{eventLabel(ev)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {editPunishmentType === "MinutesLimit" && (
              <TextField
                label="Límite de minutos"
                type="number"
                size="small"
                fullWidth
                value={editMinutesLimit}
                onChange={(e) => setEditMinutesLimit(e.target.value)}
                inputProps={{ min: 1, step: 1 }}
                required
              />
            )}

            <TextField label="Multa (€)" type="number" size="small" fullWidth value={editRow?.sanction.fine ?? ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, fine: e.target.value === "" ? null : Number(e.target.value) } } : r)} inputProps={{ min: 0, step: 0.01 }} />
            <TextField
              label="Importe pagado (€)"
              type="number"
              size="small"
              fullWidth
              value={editAmountPaid}
              onChange={(e) => setEditAmountPaid(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
              helperText="No puede superar la multa"
            />
            <TextField label="Fecha fin" type="date" size="small" fullWidth value={editRow?.sanction.endDate ? editRow.sanction.endDate.slice(0,10) : ""} onChange={(e) => setEditRow(r => r ? { ...r, sanction: { ...r.sanction, endDate: e.target.value || null } } : r)} InputLabelProps={{ shrink: true }} helperText="Rellena para marcar la sanción como finalizada" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>Cancelar</Button>
          <Button variant="contained" onClick={() => handleEditSave({ startDate: editRow?.sanction.startDate ?? "", sanctionType: editRow?.sanction.sanctionType ?? "", description: editRow?.sanction.description ?? null, estimatedEnd: editRow?.sanction.estimatedEnd ?? null, endDate: editRow?.sanction.endDate ?? null, fine: editRow?.sanction.fine ?? null })} disabled={editSaving}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </BaseLayout>
  );
}
