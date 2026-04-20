import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import SearchIcon from "@mui/icons-material/Search";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import RestoreIcon from "@mui/icons-material/Restore";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SyncIcon from "@mui/icons-material/Sync";
import AssessmentIcon from "@mui/icons-material/Assessment";

import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../../../shared/components/ui/GroupSelector/GroupSelector";
import TeamsSelector from "../../../../shared/components/ui/TeamsSelector/TeamsSelector";
import SeasonSelector from "../../../../shared/components/ui/SeasonSelector/SeasonSelector";

import { getPlayersByTeam } from "../../../federation/services/api";
import type { Player as FedPlayer } from "../../../federation/types/team";
import { getUserClubs } from "../../services/clubService";
import type { UserClubsResponse } from "../../types/userClubs";
import { getCategories } from "../../services/competitionService";
import type { Category } from "../../services/competitionService";
import { importFederationTeam } from "../../services/seasonPrepService";
import { getPlayersByTeam as getCoachTeamPlayers } from "../../services/teamplayerService";
import { getTeams } from "../../services/teamService";
import type { PlayerResponse } from "../../services/teamplayerService";
import { getDemarcations } from "../../services/demarcationService";
import type { DemarcationOption } from "../../services/demarcationService";
import {
  getSeasonPrepSession,
  upsertSeasonPrepSession,
  deleteSeasonPrepSession,
} from "../../services/seasonPrepSessionService";

import styles from "./SeasonPrep.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

const FED_SEASONS = [
  { value: "26", label: "2025-26" },
  { value: "25", label: "2024-25" },
  { value: "24", label: "2023-24" },
  { value: "23", label: "2022-23" },
  { value: "22", label: "2021-22" },
  { value: "21", label: "2020-21" },
];

type Assignment = "pool" | "eligible" | "discard";

export type RecruitmentStatus = "observando" | "interesado" | "fichado" | "descartado";

export type AttributeScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; // 1-4 Insuf, 5 Suf, 6 Bien, 7-8 Notable, 9-10 Sobresaliente

export type PlayerEvaluation = {
  // Físico (ambos)
  velocidad?: AttributeScore;
  altura?: AttributeScore;
  // Físico — porteros
  reflejos?: AttributeScore;
  // Físico — jugadores
  fuerza?: AttributeScore;
  // Técnica — porteros
  blocajes?: AttributeScore;
  rechaces?: AttributeScore;
  desvios?: AttributeScore;
  prolongaciones?: AttributeScore;
  salto?: AttributeScore;
  controlOrientado?: AttributeScore;
  saqueLargo?: AttributeScore;
  saqueMano?: AttributeScore;
  // Competitividad — porteros
  unVsUno?: AttributeScore;
  balonesAereos?: AttributeScore;
  // Defensa — jugadores
  valentia?: AttributeScore;
  duelosGanados?: AttributeScore;
  balonesDivididos?: AttributeScore;
  marcajeFerreo?: AttributeScore;
  pressingTrasPerdida?: AttributeScore;
  // Ataque — jugadores
  visionDeJuego?: AttributeScore;
  atraviesaLineas?: AttributeScore;
  centrosLargos?: AttributeScore;
  tiroAPuerta?: AttributeScore;
  segundasJugadas?: AttributeScore;
  notes?: string;
};

export type PoolPlayer = FedPlayer & {
  uniqueId: string;
  assignment: Assignment;
  manualEntry?: boolean;
  birthYear?: number;
  procedencia?: string;
  evaluation?: PlayerEvaluation;
  recruitmentStatus?: RecruitmentStatus;
};

type TeamSlot = {
  competition?: string;
  group?: string;
  teamId?: string;
  teamName?: string;
  players: FedPlayer[];
  loading: boolean;
  loaded: boolean;
  fromLocal?: boolean;
};

const emptySlot = (): TeamSlot => ({
  players: [],
  loading: false,
  loaded: false,
});

// ── Coach DB lookup helpers ───────────────────────────────────────────────

async function findCoachTeam(
  teamName: string
): Promise<{ teamId: string; teamName: string } | null> {
  try {
    const clubs: UserClubsResponse[] = await getUserClubs();
    for (const club of clubs) {
      const teams = await getTeams(club.clubId);
      const match = teams.find(
        (t) =>
          t.name.trim().toLowerCase() === teamName.trim().toLowerCase()
      );
      if (match) return { teamId: match.id, teamName: match.name };
    }
  } catch {
    // ignore — fall through to federation
  }
  return null;
}

function isGk(pos?: string | null): boolean {
  if (!pos) return false;
  const p = pos.toLowerCase();
  return p.includes("portero") || p.includes("keeper") || p.includes("arquero");
}

function coachPlayersToFed(
  players: PlayerResponse[],
  teamName: string
): FedPlayer[] {
  return players.map((p) => ({
    playerId: p.id,
    seasonId: "",
    name: p.lastName ? `${p.name} ${p.lastName}`.trim() : p.name,
    age: 0,
    birthYear: 0,
    team: teamName,
    teamCode: "",
    teamCategory: "",
    jerseyNumber: p.dorsal != null ? String(p.dorsal) : "",
    position: p.position ?? "",
    isGoalkeeper: isGk(p.position),
    photoUrl: p.urlPhoto ?? "",
    teamShieldUrl: "",
    matches: { called: 0, starter: 0, substitute: 0, played: 0, totalGoals: 0, goalsPerMatch: 0 },
    cards: { yellow: 0, red: 0, doubleYellow: 0 },
    competitions: [],
  }));
}

// ── Save dialog ───────────────────────────────────────────────────────────────

function SaveDialog({
  open,
  teamName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  teamName: string;
  onClose: () => void;
  onConfirm: (params: {
    clubId: string;
    categoryId: number;
    seasonId: string;
  }) => void;
}) {
  const [clubs, setClubs] = useState<UserClubsResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clubId, setClubId] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [seasonId, setSeasonId] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    Promise.all([getUserClubs(), getCategories()])
      .then(([c, cats]) => {
        if (!mounted) return;
        setClubs(c);
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  const canConfirm = !!clubId && !!categoryId && !!seasonId;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Guardar en Coach DB</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Se guardará el equipo <strong>{teamName}</strong> con todos sus
              jugadores bajo el club y temporada seleccionados. Si el equipo ya
              existe, se omitirán los jugadores duplicados.
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Club</InputLabel>
              <Select
                value={clubId}
                label="Club"
                onChange={(e) => setClubId(e.target.value)}
              >
                {clubs.map((c) => (
                  <MenuItem key={c.clubId} value={c.clubId}>
                    {c.clubName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Categoría</InputLabel>
              <Select
                value={categoryId}
                label="Categoría"
                onChange={(e) =>
                  setCategoryId(e.target.value as number)
                }
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <SeasonSelector value={seasonId} onChange={(v) => setSeasonId(v ?? "")} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!canConfirm || loading}
          onClick={() =>
            onConfirm({
              clubId,
              categoryId: categoryId as number,
              seasonId,
            })
          }
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Team picker panel ─────────────────────────────────────────────────────────

function TeamPickerPanel({
  fedSeason,
  slot,
  onSlotChange,
  onFetch,
}: {
  fedSeason: string;
  slot: TeamSlot;
  onSlotChange: (patch: Partial<TeamSlot>) => void;
  onFetch: () => void;
}) {
  return (
    <Box>
      <div className={styles.selectorRow}>
        <Grid container spacing={1} alignItems="flex-end">
          <Grid item xs={12} sm={4}>
            <CompetitionSelector
              value={slot.competition}
              onChange={(c) => {
                // Only cascade-reset downstream if the user picked a DIFFERENT competition
                if (c?.id === slot.competition) return;
                onSlotChange({
                  competition: c?.id,
                  group: undefined,
                  teamId: undefined,
                  teamName: undefined,
                  players: [],
                  loaded: false,
                });
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <GroupSelector
              competitionId={slot.competition}
              value={slot.group}
              onChange={(g) => {
                // Only cascade-reset downstream if the user picked a DIFFERENT group
                if (g?.id === slot.group) return;
                onSlotChange({
                  group: g?.id,
                  teamId: undefined,
                  teamName: undefined,
                  players: [],
                  loaded: false,
                });
              }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TeamsSelector
              competitionId={slot.competition}
              groupId={slot.group}
              season={fedSeason}
              value={slot.teamId}
              onChange={(t) => {
                // Only cascade-reset when the user picks a DIFFERENT team
                if (t?.id === slot.teamId) return;
                onSlotChange({
                  teamId: t?.id,
                  teamName: t?.name,
                  players: [],
                  loaded: false,
                });
              }}
            />
          </Grid>
        </Grid>
      </div>
      <div className={styles.selectorActions}>
        <Button
          size="small"
          variant="outlined"
          startIcon={
            slot.loading ? <CircularProgress size={14} /> : <SearchIcon />
          }
          disabled={!slot.teamId || slot.loading}
          onClick={onFetch}
        >
          Obtener plantilla
        </Button>
        {slot.loaded && (
          <Chip
            size="small"
            label={`${slot.players.length} jugadores`}
            className={styles.saveChip}
          />
        )}
      </div>
    </Box>
  );
}

// ── Demarcation dialog ────────────────────────────────────────────────────────

function DemarcationDialog({
  open,
  playerName,
  currentPosition,
  onClose,
  onConfirm,
}: {
  open: boolean;
  playerName: string;
  currentPosition: string;
  onClose: () => void;
  onConfirm: (position: string) => void;
}) {
  const [value, setValue] = useState(currentPosition);
  const [options, setOptions] = useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setValue(currentPosition);
    getDemarcations()
      .then((list: DemarcationOption[]) => setOptions(list.map((d) => d.name)))
      .catch(() => setOptions([]));
  }, [open, currentPosition]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>Demarcación</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }}>
          {playerName}
        </Typography>
        <Autocomplete
          freeSolo
          options={options}
          value={value}
          onInputChange={(_e, v) => setValue(v)}
          onChange={(_e, v) => setValue(v ?? "")}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Posición"
              size="small"
              autoFocus
              placeholder="Escribe o elige una posición"
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={() => onConfirm(value.trim())}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Player card (draggable) ───────────────────────────────────────────────────

function PlayerCard({
  player,
  onDragStart,
  isDragging,
  onReturn,
  onEditPosition,
  onAddToEligible,
  showTeam,
  noDim,
}: {
  player: PoolPlayer;
  onDragStart: (e: React.DragEvent, uniqueId: string) => void;
  isDragging: boolean;
  onReturn?: (uniqueId: string) => void;
  onEditPosition?: (uniqueId: string) => void;
  onAddToEligible?: (uniqueId: string) => void;
  showTeam?: boolean;
  noDim?: boolean;
}) {
  const isOut = player.assignment !== "pool";
  return (
    <div
      className={`${styles.playerCard}${isDragging ? ` ${styles.dragging}` : ""}`}
      draggable={!isOut}
      onDragStart={(e) => !isOut && onDragStart(e, player.uniqueId)}
      style={isOut && !noDim ? { opacity: 0.35 } : undefined}
      title={isOut ? "Ya asignado" : "Arrastra a Elegidos"}
    >
      <span className={styles.playerDorsal}>
        {player.jerseyNumber || "-"}
      </span>
      <span className={styles.playerName}>{player.name}</span>
      {showTeam && player.team && (
        <Chip
          size="small"
          label={player.team}
          sx={{ height: 14, fontSize: "0.6rem", ml: 0.5, opacity: 0.75 }}
        />
      )}
      <Tooltip title="Editar demarcación">
        <span
          className={styles.playerPosition}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}
          onClick={(e) => { e.stopPropagation(); onEditPosition?.(player.uniqueId); }}
        >
          {player.position || <span style={{ opacity: 0.35 }}>—</span>}
          <EditIcon sx={{ fontSize: 10, opacity: 0.5, ml: 0.3 }} />
        </span>
      </Tooltip>
      <span className={styles.playerStats}>
        <Tooltip title="Convocatorias">
          <span className={styles.statItem}>C:{player.matches?.called ?? 0}</span>
        </Tooltip>
        <Tooltip title="Titularidades">
          <span className={styles.statItem}>T:{player.matches?.starter ?? 0}</span>
        </Tooltip>
        <Tooltip title="Partidos jugados">
          <span className={styles.statItem}>
            <SportsSoccerIcon sx={{ fontSize: 10 }} />
            {player.matches?.played ?? 0}
          </span>
        </Tooltip>
        <Tooltip title="Goles">
          <span className={styles.statItem}>G:{player.matches?.totalGoals ?? 0}</span>
        </Tooltip>
        <Tooltip title="Amonestaciones">
          <span className={styles.statItem}>🟨{player.cards?.yellow ?? 0}</span>
        </Tooltip>
        {(player.cards?.red ?? 0) > 0 && (
          <Tooltip title="Expulsiones">
            <span className={styles.statItem}>🟥{player.cards.red}</span>
          </Tooltip>
        )}
      </span>
      {!isOut && onAddToEligible && (
        <Tooltip title="Añadir a elegidos">
          <ThumbUpIcon
            sx={{ fontSize: 14, cursor: "pointer", opacity: 0.5, ml: 0.5, flexShrink: 0, '&:hover': { opacity: 1, color: '#4caf50' } }}
            onClick={(e) => { e.stopPropagation(); onAddToEligible(player.uniqueId); }}
          />
        </Tooltip>
      )}
      {isOut && onReturn && (
        <Tooltip title="Devolver al pool">
          <RestoreIcon
            sx={{ fontSize: 14, cursor: "pointer", opacity: 0.7, ml: 0.5 }}
            onClick={() => onReturn(player.uniqueId)}
          />
        </Tooltip>
      )}
    </div>
  );
}

// ── Group players by position (moved here so DropZone can use it) ─────────────

function positionRank(pos: string): number {
  const p = pos.toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero")) return 1;
  if (p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante")) return 2;
  if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger")) return 3;
  return 99;
}

function groupPlayersByPosition(
  players: PoolPlayer[]
): Array<{ label: string; players: PoolPlayer[] }> {
  const map = new Map<string, PoolPlayer[]>();
  for (const p of players) {
    const key = p.position?.trim() || "Sin demarcación";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ra = positionRank(a);
      const rb = positionRank(b);
      if (ra !== rb) return ra - rb;
      if (a === "Sin demarcación") return 1;
      if (b === "Sin demarcación") return -1;
      return a.localeCompare(b, "es");
    })
    .map(([label, players]) => ({ label, players }));
}

function GroupedPlayers({
  players,
  onDragStart,
  draggingIdState,
  onReturn,
  onEditPosition,
  onAddToEligible,
  showTeam,
  noDim,
}: {
  players: PoolPlayer[];
  onDragStart: (e: React.DragEvent, uniqueId: string) => void;
  draggingIdState: string | null;
  onReturn: (uniqueId: string) => void;
  onEditPosition: (uniqueId: string) => void;
  onAddToEligible?: (uniqueId: string) => void;
  showTeam?: boolean;
  noDim?: boolean;
}) {
  const groups = groupPlayersByPosition(players);
  return (
    <>
      {groups.map((g) => (
        <div key={g.label}>
          <div className={styles.posGroupLabel}>{g.label}</div>
          {g.players.map((p) => (
            <PlayerCard
              key={p.uniqueId}
              player={p}
              onDragStart={onDragStart}
              isDragging={draggingIdState === p.uniqueId}
              onReturn={onReturn}
              onEditPosition={onEditPosition}
              onAddToEligible={onAddToEligible}
              showTeam={showTeam}
              noDim={noDim}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  accept,
  players,
  onDrop,
  onReturn,
  onEditPosition,
  onClearAll,
  draggingId,
}: {
  accept: Assignment;
  players: PoolPlayer[];
  onDrop: (uniqueId: string, target: Assignment) => void;
  onReturn: (uniqueId: string) => void;
  onEditPosition: (uniqueId: string) => void;
  onClearAll: () => void;
  draggingId: string | null;
}) {
  const [over, setOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setOver(true);
  }

  function handleDragLeave() {
    setOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (id) onDrop(id, accept);
  }

  const assigned = players.filter((p) => p.assignment === accept);

  return (
    <div
      className={`${styles.dropZone} ${styles.dropZoneEligible}${over ? ` ${styles.over}` : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`${styles.dropZoneTitle} ${styles.eligibleTitle}`}>
        <ThumbUpIcon sx={{ fontSize: 16 }} />
        Elegidos para evaluar
        {assigned.length > 0 && (
          <Chip size="small" label={assigned.length} sx={{ ml: 0.5, height: 18, fontSize: "0.7rem" }} />
        )}
        {assigned.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            color="warning"
            sx={{ ml: "auto", fontSize: "0.68rem", py: "1px", px: 1 }}
            onClick={onClearAll}
          >
            Limpiar lista
          </Button>
        )}
      </div>
      {assigned.length === 0 ? (
        <div className={styles.emptyDrop}>
          Arrastra jugadores aquí
        </div>
      ) : (
        <GroupedPlayers
          players={assigned}
          onDragStart={() => {}}
          draggingIdState={draggingId}
          onReturn={onReturn}
          onEditPosition={onEditPosition}
          showTeam
          noDim
        />
      )}
    </div>
  );
}

// ── Persistence type ─────────────────────────────────────────────────────────

type PersistedState = {
  fedSeason: string;
  slot: Omit<TeamSlot, "loading">;
  pool: PoolPlayer[];
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SeasonPrep() {
  const navigate = useNavigate();
  const [fedSeason, setFedSeason] = useState("26");
  const [slot, setSlot] = useState<TeamSlot>(emptySlot());

  // Pool of all players loaded
  const [pool, setPool] = useState<PoolPlayer[]>([]);

  // Must be declared before the effects that use them
  const isLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents cascade-reset in selectors while session is being restored
  const restoringRef = useRef(true);

  // Snackbar — declared early so the load effect can reference setSnackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    severity: "success" | "error" | "info";
    message: string;
  }>({ open: false, severity: "info", message: "" });

  const showSnack = useCallback(
    (message: string, severity: "success" | "error" | "info" = "info") => {
      setSnackbar({ open: true, severity, message });
    },
    []
  );

  // Load persisted session from DB on mount
  useEffect(() => {
    let mounted = true;
    getSeasonPrepSession()
      .then((saved) => {
        if (!mounted) return;
        if (saved) {
          setFedSeason(saved.fedSeason ?? "26");
          const s = (saved as unknown as PersistedState).slot;
          const restoredPool = ((saved as unknown as PersistedState).pool as PoolPlayer[]) ?? [];
          setPool(restoredPool);

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const toFedPlayer = ({ uniqueId: _uid, assignment: _as, ...fed }: PoolPlayer) =>
            fed as unknown as FedPlayer;

          const playersFromPool = restoredPool.length > 0
            ? restoredPool.map(toFedPlayer)
            : (s?.players ?? []);

          if (playersFromPool.length > 0) {
            setSlot({
              players: playersFromPool,
              loaded: true,
              loading: false,
              teamName: s?.teamName,
              fromLocal: s?.fromLocal,
              competition: s?.competition,
              group: s?.group,
              teamId: s?.teamId,
            });
            setSnackbar({ open: true, severity: "info", message: "Sesión anterior restaurada" });
          }
        }
        isLoadedRef.current = true;
        setTimeout(() => { restoringRef.current = false; }, 1500);
      })
      .catch(() => {
        isLoadedRef.current = true;
        restoringRef.current = false;
        setSnackbar({ open: true, severity: "error", message: "No se pudo cargar la sesión guardada" });
      });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to DB (debounced 1 s) — only after the initial load completes
  useEffect(() => {
    if (!isLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      upsertSeasonPrepSession({
        fedSeason,
        slot: { ...slot, loading: false },
        pool,
      }).catch(() => {
        setSnackbar({ open: true, severity: "error", message: "Error al guardar sesión automáticamente" });
      });
    }, 1000);
  }, [fedSeason, slot, pool]);

  // Which player is currently being dragged
  const draggingId = useRef<string | null>(null);
  const [draggingIdState, setDraggingIdState] = useState<string | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Demarcation edit dialog
  const [demarcDialog, setDemarcDialog] = useState<{
    open: boolean;
    uniqueId: string;
    playerName: string;
    currentPosition: string;
  }>({ open: false, uniqueId: "", playerName: "", currentPosition: "" });

  function handleEditPosition(uniqueId: string) {
    const p = pool.find((pl) => pl.uniqueId === uniqueId);
    if (!p) return;
    setDemarcDialog({
      open: true,
      uniqueId,
      playerName: p.name,
      currentPosition: p.position ?? "",
    });
  }

  function handleDemarcConfirm(position: string) {
    setPool((prev) =>
      prev.map((p) =>
        p.uniqueId === demarcDialog.uniqueId ? { ...p, position } : p
      )
    );
    setDemarcDialog((d) => ({ ...d, open: false }));
  }

  const [updatingStats, setUpdatingStats] = useState(false);

  async function handleUpdateFedStats() {
    if (!slot.loaded || !slot.teamId) {
      showSnack("Selecciona un equipo con ID de federación para actualizar sus stats", "error");
      return;
    }
    setUpdatingStats(true);
    try {
      const team = await getPlayersByTeam(slot.teamId);
      const fresh = team?.players ?? [];
      const byId = new Map(fresh.map((p) => [p.playerId, p]));
      const byName = new Map(fresh.map((p) => [p.name.toLowerCase().trim(), p]));
      const updates = new Map<string, Pick<FedPlayer, "matches" | "cards">>();
      for (const poolPlayer of pool) {
        const f =
          byId.get(poolPlayer.playerId) ??
          byName.get(poolPlayer.name.toLowerCase().trim());
        if (f) updates.set(poolPlayer.uniqueId, { matches: f.matches, cards: f.cards });
      }
      setPool((prev) =>
        prev.map((p) => {
          const upd = updates.get(p.uniqueId);
          return upd ? { ...p, ...upd } : p;
        })
      );
      showSnack(`Stats de federación actualizadas para ${updates.size} jugadores`, "success");
    } catch {
      showSnack("Error al actualizar stats de federación", "error");
    } finally {
      setUpdatingStats(false);
    }
  }

  // Build pool from team players
  const rebuildPool = useCallback((players: FedPlayer[]) => {
    setPool((prev) => {
      const prevMap = new Map<string, PoolPlayer>(prev.map((p) => [p.uniqueId, p]));
      const hasStats = (p: FedPlayer) =>
        (p.matches?.played ?? 0) > 0 ||
        (p.matches?.called ?? 0) > 0 ||
        (p.matches?.starter ?? 0) > 0;

      // Map new team's players, preserving existing assignments (e.g. already eligible)
      const newTeamPlayers = players.map((p, i) => {
        const uid = `${p.playerId || i}`;
        const existing = prevMap.get(uid);
        return {
          ...p,
          matches: hasStats(p) ? p.matches : (existing?.matches ?? p.matches),
          cards: hasStats(p) ? p.cards : (existing?.cards ?? p.cards),
          uniqueId: uid,
          assignment: existing?.assignment ?? "pool",
        };
      });

      // Keep eligible players from previous teams that are NOT in the new team
      const newTeamIds = new Set(newTeamPlayers.map((p) => p.uniqueId));
      const prevEligible = prev.filter(
        (p) => p.assignment === "eligible" && !newTeamIds.has(p.uniqueId)
      );

      return [...prevEligible, ...newTeamPlayers];
    });
  }, []);

  // Fetch team squad
  async function fetchTeam() {
    if (!slot.teamId || !slot.teamName) return;
    setSlot((s) => ({ ...s, loading: true, players: [], loaded: false }));
    try {
      // 1. Check Coach DB first
      const localTeam = await findCoachTeam(slot.teamName);
      if (localTeam) {
        const localPlayers = await getCoachTeamPlayers(localTeam.teamId);
        const players = coachPlayersToFed(localPlayers, localTeam.teamName);
        setSlot((s) => ({
          ...s,
          loading: false,
          players,
          loaded: true,
          teamName: localTeam.teamName,
          fromLocal: true,
        }));
        rebuildPool(players);
        showSnack(`Plantilla cargada desde Coach DB: ${players.length} jugadores`, "info");
        return;
      }
      // 2. Fall back to federation
      const team = await getPlayersByTeam(slot.teamId);
      const players = team?.players ?? [];
      setSlot((s) => ({
        ...s,
        loading: false,
        players,
        loaded: true,
        teamName: team?.teamName || s.teamName,
        fromLocal: false,
      }));
      rebuildPool(players);
      showSnack(`Plantilla cargada desde federación: ${players.length} jugadores`, "success");
    } catch {
      setSlot((s) => ({ ...s, loading: false }));
      showSnack("Error al obtener la plantilla del equipo", "error");
    }
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, uniqueId: string) {
    e.dataTransfer.setData("text/plain", uniqueId);
    draggingId.current = uniqueId;
    setDraggingIdState(uniqueId);
  }

  function handleDrop(uniqueId: string, target: Assignment) {
    draggingId.current = null;
    setDraggingIdState(null);
    setPool((prev) =>
      prev.map((p) =>
        p.uniqueId === uniqueId ? { ...p, assignment: target } : p
      )
    );
  }

  function handleReturn(uniqueId: string) {
    setPool((prev) =>
      prev.map((p) =>
        p.uniqueId === uniqueId ? { ...p, assignment: "pool" } : p
      )
    );
  }

  function handleClearEligible() {
    setPool((prev) =>
      prev.map((p) => (p.assignment === "eligible" ? { ...p, assignment: "pool" } : p))
    );
  }

  async function handleClearTeam() {
    const newSlot: TeamSlot = { players: [], loaded: false, loading: false };
    setSlot(newSlot);
    setPool([]);
    try {
      await deleteSeasonPrepSession();
    } catch {
      showSnack("Error al limpiar la sesión guardada", "error");
    }
  }

  function handleGlobalDragEnd() {
    draggingId.current = null;
    setDraggingIdState(null);
  }

  // Save to Coach DB
  async function handleSaveConfirm(params: {
    clubId: string;
    categoryId: number;
    seasonId: string;
  }) {
    if (!slot.loaded || !slot.players.length || !slot.teamName) {
      showSnack("No hay equipo cargado para guardar", "error");
      return;
    }
    setSaveDialogOpen(false);
    setSaving(true);
    try {
      const poolPositionMap = new Map<string, string>(
        pool.map((p) => [p.uniqueId, p.position ?? ""])
      );
      const playersWithPositions = slot.players.map((player, i) => {
        const uniqueId = `${player.playerId || i}`;
        const updatedPosition = poolPositionMap.get(uniqueId);
        return updatedPosition !== undefined ? { ...player, position: updatedPosition } : player;
      });
      const result = await importFederationTeam({
        clubId: params.clubId,
        categoryId: params.categoryId,
        seasonId: params.seasonId,
        federationTeamName: slot.teamName,
        players: playersWithPositions,
      });
      await upsertSeasonPrepSession({
        fedSeason,
        slot: { ...slot, loading: false },
        pool,
      });
      showSnack(
        `Guardado: ${result.saved} jugadores añadidos, ${result.skipped} ya existían${result.errors > 0 ? `, ${result.errors} errores` : ""}.`,
        result.errors > 0 ? "error" : "success"
      );

    } catch (err: unknown) {
      showSnack(
        `Error al guardar: ${(err as Error)?.message ?? "Error desconocido"}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  const byStarters = (a: PoolPlayer, b: PoolPlayer) =>
    (b.matches?.starter ?? 0) - (a.matches?.starter ?? 0);

  // Only show players from the current team in Col 1
  const currentTeamIds = new Set(
    slot.players.map((p, i) => `${p.playerId || i}`)
  );
  const poolPlayers = pool
    .filter((p) => currentTeamIds.has(p.uniqueId))
    .sort(byStarters);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Preparación nueva temporada"
        actionBar={
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/dashboard")}
            >
              Volver
            </Button>
            {slot.loaded && (
              <Button
                size="small"
                variant="contained"
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                disabled={saving}
                onClick={() => setSaveDialogOpen(true)}
              >
                Guardar en Coach
              </Button>
            )}
            {slot.loaded && (
              <Button
                size="small"
                variant="outlined"
                startIcon={updatingStats ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />}
                disabled={updatingStats}
                onClick={handleUpdateFedStats}
              >
                Actualizar stats
              </Button>
            )}
            {pool.some((p) => p.assignment === "eligible") && (
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<AssessmentIcon />}
                onClick={() => navigate("/coach/season-prep/evaluate")}
              >
                Evaluar
              </Button>
            )}
          </>
        }
      >
        <div
          className={styles.container}
          onDragEnd={handleGlobalDragEnd}
        >
          {/* ── Season selector ───────────────────────────────────────── */}
          <Accordion
            defaultExpanded
            className={styles.accordion}
            elevation={0}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600, fontSize: "0.92rem" }}>
                Buscar plantilla de federación
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {/* Fed season */}
              <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Typography className={styles.sectionLabel} sx={{ mb: 0 }}>
                  Temporada federación:
                </Typography>
                <FormControl size="small" className={styles.seasonField}>
                  <InputLabel>Temporada</InputLabel>
                  <Select
                    value={fedSeason}
                    label="Temporada"
                    onChange={(e) => {
                      setFedSeason(e.target.value);
                      setSlot((s) => ({
                        ...s,
                        teamId: undefined,
                        teamName: undefined,
                        players: [],
                        loaded: false,
                      }));
                      setPool([]);
                    }}
                  >
                    {FED_SEASONS.map((s) => (
                      <MenuItem key={s.value} value={s.value}>
                        {s.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <TeamPickerPanel
                fedSeason={fedSeason}
                slot={slot}
                onSlotChange={(patch) => {
                  if (restoringRef.current) return;
                  setSlot((s) => ({ ...s, ...patch }));
                }}
                onFetch={fetchTeam}
              />
            </AccordionDetails>
          </Accordion>

          {/* ── Board ──────────────────────────────────────────────────── */}
          {slot.loaded && (
            <div className={styles.boardGrid}>
              {/* Col 1: Team players */}
              {slot.loaded && (
              <div>
                <div className={styles.colHeader}>
                  {slot.teamName || "Equipo"}
                  {saving && (
                    <CircularProgress size={10} sx={{ ml: 0.5, verticalAlign: "middle" }} />
                  )}
                </div>
                <div className={styles.teamPanel}>
                  <div className={styles.teamPanelHeader}>
                    <SportsSoccerIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                    <Typography className={styles.teamPanelSubtitle}>
                      {slot.players.length} jugadores
                    </Typography>
                    {slot.loaded && (
                      <Chip
                        size="small"
                        label={slot.fromLocal ? "Coach DB" : "Federación"}
                        sx={{
                          height: 16,
                          fontSize: "0.65rem",
                          ml: 0.5,
                          bgcolor: slot.fromLocal ? "rgba(78,201,176,0.15)" : "rgba(77,157,224,0.15)",
                          color: slot.fromLocal ? "#4ec9b0" : "#4d9de0",
                        }}
                      />
                    )}
                    <Box sx={{ display: "flex", gap: 0.5, ml: "auto" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        sx={{ fontSize: "0.7rem", py: "1px", px: 1 }}
                        onClick={handleClearTeam}
                      >
                        Limpiar lista
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.7rem", py: "1px", px: 1 }}
                        disabled={poolPlayers.every((p) => p.assignment !== "pool")}
                        onClick={() =>
                          setPool((prev) =>
                            prev.map((p) =>
                              currentTeamIds.has(p.uniqueId) && p.assignment === "pool"
                                ? { ...p, assignment: "eligible" }
                                : p
                            )
                          )
                        }
                      >
                        Añadir todos
                      </Button>
                    </Box>
                  </div>
                  {slot.players.length === 0 ? (
                    <Typography className={styles.noPlayerMsg}>Sin jugadores cargados</Typography>
                  ) : (
                    <GroupedPlayers
                      players={poolPlayers}
                      onDragStart={handleDragStart}
                      draggingIdState={draggingIdState}
                      onReturn={handleReturn}
                      onEditPosition={handleEditPosition}
                      onAddToEligible={(uid) =>
                        setPool((prev) =>
                          prev.map((p) =>
                            p.uniqueId === uid ? { ...p, assignment: 'eligible' } : p
                          )
                        )
                      }
                      showTeam
                    />
                  )}
                </div>
              </div>
              )}

              {/* Col 2: Elegidos */}
              <div>
                <div className={`${styles.colHeader} ${styles.eligibleTitle}`}>
                  Elegidos para evaluar
                </div>
                <DropZone
                  accept="eligible"
                  players={pool}
                  onDrop={handleDrop}
                  onReturn={handleReturn}
                  onEditPosition={handleEditPosition}
                  onClearAll={handleClearEligible}
                  draggingId={draggingIdState}
                />
              </div>

            </div>
          )}
        </div>

        {/* Demarcation dialog */}
        <DemarcationDialog
          open={demarcDialog.open}
          playerName={demarcDialog.playerName}
          currentPosition={demarcDialog.currentPosition}
          onClose={() => setDemarcDialog((d) => ({ ...d, open: false }))}
          onConfirm={handleDemarcConfirm}
        />

        {/* Save dialog */}
        <SaveDialog
          open={saveDialogOpen}
          teamName={slot.teamName ?? ""}
          onClose={() => setSaveDialogOpen(false)}
          onConfirm={handleSaveConfirm}
        />

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </ContentLayout>
    </BaseLayout>
  );
}
