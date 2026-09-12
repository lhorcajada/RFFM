import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import ConfirmDialog from "../../../../shared/components/ui/ConfirmDialog/ConfirmDialog";
import useTeamAndClub from "../../hooks/useTeamAndClub.tsx";
import teamplayerService from "../../services/teamplayerService";
import playerService from "../../services/playerService";
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
import { getMyProfile } from "../../services/coachApi";
import { getTeamFund } from "../../services/teamFundService";
import { TEAM_FUND_UPDATED_EVENT } from "../../../../shared/hooks/useTeamFundBalance";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import SanctionCard from "./components/SanctionCard";
import SanctionsSummaryCards from "./components/SanctionsSummaryCards";
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
  const goToTeamDashboard = useTeamDashboardBack();
  const { team, teamTitleNode } = useTeamAndClub();

  const _roles = coachAuthService.getRoles();
  const isPlayerOrFamily =
    (_roles.includes("Player") || _roles.includes("FamilyPlayer") || _roles.includes("FamilyMember")) &&
    !_roles.includes("Coach") &&
    !_roles.includes("Administrator");

  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [rows, setRows] = useState<SanctionRow[]>([]);
  const [events, setEvents] = useState<SportEventResponse[]>([]);
  const [fundBalance, setFundBalance] = useState<number | null>(null);
  const [playerPhotos, setPlayerPhotos] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<"mine" | "all">("mine");

  const [liftTarget, setLiftTarget] = useState<SanctionRow | null>(null);
  const [liftProcessing, setLiftProcessing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SanctionRow | null>(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);

  useEffect(() => {
    if (!isPlayerOrFamily) return;
    let mounted = true;
    getMyProfile().then((profile) => {
      if (mounted) setMyPlayerId(profile?.playerId ?? null);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A "mine vs all" filter only makes sense once we know which player is "mine".
  const canFilterMine = isPlayerOrFamily && !!myPlayerId;
  const visibleRows = useMemo(() => {
    if (canFilterMine && filterMode === "mine") {
      return rows.filter((r) => r.player.id === myPlayerId);
    }
    return rows;
  }, [rows, canFilterMine, filterMode, myPlayerId]);

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  /** Team-wide totals for the summary header, independent of the "mine/all" filter
   * (design.md task 6.2 — Σ Fine / Σ PendingAmount across all rows). */
  const totalFine = useMemo(
    () => rows.reduce((sum, { sanction }) => sum + (sanction.fine ?? 0), 0),
    [rows]
  );
  const totalPending = useMemo(
    () =>
      rows.reduce((sum, { sanction }) => {
        const pending =
          sanction.pendingAmount != null
            ? sanction.pendingAmount
            : sanction.fine != null
              ? sanction.fine - (sanction.amountPaid ?? 0)
              : null;
        return sum + (pending ?? 0);
      }, 0),
    [rows]
  );

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
      getTeamFund(team.id).catch(() => null),
    ])
      .then(([list, teamSanctions, sportEvents, teamFund]) => {
        if (!mounted) return;
        setPlayers(list);
        setEvents(sportEvents.items ?? []);
        setFundBalance(teamFund?.balance ?? null);
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

        // Resolve each distinct player's photo once when the rows load (mirrors
        // Squad.tsx's playerPhotos pattern — not per-render, to avoid refetching).
        Promise.all(
          list.map(async (p) => {
            if (!p.urlPhoto) return [p.id, null] as const;
            const obj = await playerService.fetchPlayerPhoto(p.urlPhoto);
            return [p.id, obj] as const;
          })
        ).then((entries) => {
          if (!mounted) return;
          setPlayerPhotos(Object.fromEntries(entries));
        });
      })
      .catch(() => {
        if (mounted) { setPlayers([]); setRows([]); setEvents([]); setFundBalance(null); setPlayerPhotos({}); }
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
      window.dispatchEvent(new CustomEvent(TEAM_FUND_UPDATED_EVENT));
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
    window.dispatchEvent(new CustomEvent(TEAM_FUND_UPDATED_EVENT));
  }

  function handleLift(row: SanctionRow) {
    if (isPlayerOrFamily) return;
    setLiftTarget(row);
  }

  async function handleLiftConfirmed() {
    if (!liftTarget) return;
    const row = liftTarget;
    setLiftProcessing(true);
    try {
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
      setLiftTarget(null);
      setRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent(TEAM_FUND_UPDATED_EVENT));
    } finally {
      setLiftProcessing(false);
    }
  }

  function handleDelete(row: SanctionRow) {
    if (isPlayerOrFamily) return;
    if (!canDeleteSanction(row.sanction)) return;
    setDeleteTarget(row);
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    const row = deleteTarget;
    setDeleteProcessing(true);
    try {
      const ok = await deletePlayerSanction(row.player.id, row.sanction.id);
      setDeleteTarget(null);
      if (!ok) {
        window.dispatchEvent(
          new CustomEvent("rffm.show_snackbar", {
            detail: { message: "No se puede eliminar una sanción ya cumplida.", severity: "error" },
          })
        );
        return;
      }
      setRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent(TEAM_FUND_UPDATED_EVENT));
    } finally {
      setDeleteProcessing(false);
    }
  }

  function rowDisplayName(row: SanctionRow | null): string {
    if (!row) return "";
    return ((row.player.name ?? "") + " " + (row.player.lastName ?? "")).trim() || row.player.alias;
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
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            alignItems="center"
            flexWrap="wrap"
            rowGap={1}
          >
            {canFilterMine && (
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                <Button
                  onClick={() => setFilterMode("mine")}
                  variant={filterMode === "mine" ? "contained" : "outlined"}
                  size="small"
                >
                  Mis sanciones
                </Button>
                <Button
                  onClick={() => setFilterMode("all")}
                  variant={filterMode === "all" ? "contained" : "outlined"}
                  size="small"
                >
                  Todas las sanciones
                </Button>
              </Stack>
            )}
            {!isPlayerOrFamily && (
              <Button startIcon={<AddIcon />} onClick={openAdd} variant="contained" size="small" color="warning" disabled={players.length === 0}>
                Añadir sanción
              </Button>
            )}
            <Button startIcon={<ArrowBackIcon />} onClick={() => goToTeamDashboard()} variant="outlined" size="small">
              Volver
            </Button>
          </Stack>
        }
      >
        <SanctionsSummaryCards
          totalFine={totalFine}
          totalPending={totalPending}
          fundBalance={fundBalance}
        />
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={32} />
          </Stack>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title="Sin sanciones"
            description={
              canFilterMine && filterMode === "mine"
                ? "No tienes sanciones registradas actualmente."
                : "No hay sanciones registradas actualmente."
            }
          />
        ) : (
          <Stack spacing={1.5} className={styles.cardList}>
            {visibleRows.map(({ player, sanction }) => {
              const status = getStatus(sanction);
              const deletable = canDeleteSanction(sanction);
              const pendingAmount =
                sanction.pendingAmount != null
                  ? sanction.pendingAmount
                  : sanction.fine != null
                    ? sanction.fine - (sanction.amountPaid ?? 0)
                    : null;
              return (
                <SanctionCard
                  key={sanction.id}
                  player={player}
                  sanction={sanction}
                  status={status}
                  pendingAmount={pendingAmount}
                  photoSrc={playerPhotos[player.id] ?? null}
                  showPlayerName={!canFilterMine || filterMode === "all"}
                  canManage={!isPlayerOrFamily}
                  canDelete={deletable}
                  onEdit={() => openEdit({ player, sanction })}
                  onLift={() => handleLift({ player, sanction })}
                  onDelete={() => handleDelete({ player, sanction })}
                />
              );
            })}
          </Stack>
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

      <ConfirmDialog
        open={!!liftTarget}
        title="Levantar sanción"
        description={`¿Levantar sanción a ${rowDisplayName(liftTarget)}?`}
        confirmText="Levantar"
        processing={liftProcessing}
        onCancel={() => setLiftTarget(null)}
        onConfirm={handleLiftConfirmed}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar sanción"
        description={`¿Eliminar la sanción de ${rowDisplayName(deleteTarget)}?`}
        confirmText="Eliminar"
        processing={deleteProcessing}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
      />
    </BaseLayout>
  );
}
