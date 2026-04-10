import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slide,
  Snackbar,
  Tab,
  Tabs,
  Tooltip,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import sportEventService from "../../services/sportEventService";
import sportEventTypeService from "../../services/sportEventTypeService";
import convocationService from "../../services/convocationService";
import excuseTypeService, {
  ExcuseType,
} from "../../services/excuseTypeService";
import teamplayerService, {
  PlayerResponse,
} from "../../services/teamplayerService";
import convocationStatusService, {
  ConvocationStatus,
} from "../../services/convocationStatusService";
import configurationCoachService from "../../services/configurationCoachService";
import playerRatingService from "../../services/playerRatingService";
import playerService from "../../services/playerService";
import availabilityTypeService from "../../services/availabilityTypeService";
import type { PlayerRating } from "../../types/playerRating";
import PlayerCromo from "../squad/components/PlayerCromo";
import IdealLineup, { type IdealLineupHandle } from "../squad/components/IdealLineup";
import styles from "./ConvocationMatchDetail.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal match info passed via router state from Convocations calendar */
type MatchState = {
  date: string;
  time: string;
  localTeamName: string;
  localTeamShield: string;
  visitorTeamName: string;
  visitorTeamShield: string;
  isFinished: boolean;
  field: string;
  codacta: string | null;
};

/** One cell in the desconvocatorias grid */
type GridCell = {
  /** null = no convocation record this match */
  statusId: number | null;
  excuseTypeId: number | null;
  statusName: string;
  excuseName: string | null;
};

/** A past match event enriched with the full convocation map */
type MatchColumn = {
  eventId: string;
  label: string; // short label e.g. "J3 · 12 abr"
  date: string;
  rival: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Status IDs considered "not called up" / "declined" — adjust to match DB values */
const NOT_CALLED_STATUS_IDS = new Set([2, 3]); // 2=Desconvocado, 3=No disponible

/** Status ID used when calling up a player */
const CALLED_STATUS_ID = 1;
/** Status ID for officially not called (desconvocado) */
const NOT_CALLED_STATUS_ID = 2;
/** Status ID for no disponible */
const NO_DISPONIBLE_STATUS_ID = 3;

/** Drop zones for drag-and-drop convocation management */
type DropZone = "available" | "called" | "notCalled" | "noDisponible";

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function cellColor(cell: GridCell | undefined): string {
  if (!cell || cell.statusId === null) return ""; // no data
  if (NOT_CALLED_STATUS_IDS.has(cell.statusId ?? -1)) return styles.cellAbsent;
  return styles.cellPresent;
}

function cellLabel(cell: GridCell | undefined): string {
  if (!cell || cell.statusId === null) return "—";
  if (cell.excuseName) return cell.excuseName;
  return cell.statusName || "—";
}

function mgmtRatingColor(v: number): string {
  if (v >= 90) return "#29b6f6";
  if (v >= 70) return "#66bb6a";
  if (v >= 50) return "#ffb300";
  return "#ef5350";
}

function positionOrder(pos: string | null | undefined): number {
  const p = (pos ?? "").toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero") || p.includes("stopper")) return 1;
  if (p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante")) return 2;
  if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger")) return 3;
  return 4;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConvocationMatchDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const match = (location.state as { match?: MatchState } | null)?.match ?? null;

  // teamId from query params (same pattern as other coach pages)
  const params = new URLSearchParams(location.search);
  const [teamId, setTeamId] = useState(params.get("teamId") ?? "");

  // Fallback: if no teamId in URL, load from coach configuration
  useEffect(() => {
    if (teamId) return;
    let mounted = true;
    configurationCoachService.getAll().then((configs) => {
      if (!mounted) return;
      const preferred = configs[0]?.preferredTeamId ?? "";
      if (preferred) setTeamId(preferred);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [teamId]);

  const [tab, setTab] = useState(0);

  // ── Alineación tab save ref ────────────────────────────────────────────────
  const lineupRef = useRef<IdealLineupHandle>(null);
  const [lineupSaving, setLineupSaving] = useState(false);

  // ── Data: players ──────────────────────────────────────────────────────────
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // ── Data: past match events (columns) ─────────────────────────────────────
  const [matchColumns, setMatchColumns] = useState<MatchColumn[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // ── Data: convocations per event → player → cell ──────────────────────────
  // Map<eventId, Map<playerId, GridCell>>
  const [gridData, setGridData] = useState<
    Map<string, Map<string, GridCell>>
  >(new Map());
  const [loadingGrid, setLoadingGrid] = useState(false);

  // ── Catalogs ───────────────────────────────────────────────────────────────
  const [statuses, setStatuses] = useState<ConvocationStatus[]>([]);
  const [excuseTypes, setExcuseTypes] = useState<ExcuseType[]>([]);

  // ── Convocation management tab state ──────────────────────────────────────
  const [mgmtEventId, setMgmtEventId] = useState<string | null>(null);
  const [mgmtLoadingConv, setMgmtLoadingConv] = useState(false);
  const [mgmtAvailable, setMgmtAvailable] = useState<string[]>([]);
  const [mgmtCalled, setMgmtCalled] = useState<string[]>([]);
  const [mgmtNotCalled, setMgmtNotCalled] = useState<string[]>([]);
  const [mgmtNoDisponible, setMgmtNoDisponible] = useState<string[]>([]);
  const [mgmtConvMap, setMgmtConvMap] = useState<Record<string, string>>({});
  const [mgmtRatings, setMgmtRatings] = useState<Record<string, PlayerRating>>({});
  const [mgmtPhotos, setMgmtPhotos] = useState<Record<string, string | null>>({});
  const [mgmtDragPlayer, setMgmtDragPlayer] = useState<string | null>(null);
  const [mgmtDragOver, setMgmtDragOver] = useState<DropZone | null>(null);
  const [mgmtExcuseMap, setMgmtExcuseMap] = useState<Record<string, number | null>>({});
  const [mgmtSaving, setMgmtSaving] = useState(false);
  const [mgmtSaveResult, setMgmtSaveResult] = useState<string | null>(null);

  const statusMap = useMemo(() => {
    const m = new Map<number, string>();
    statuses.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [statuses]);

  const excuseMap = useMemo(() => {
    const m = new Map<number, string>();
    excuseTypes.forEach((e) => m.set(e.id, e.name));
    return m;
  }, [excuseTypes]);

  // ── Load catalogs once ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    Promise.all([
      convocationStatusService.getConvocationStatuses(),
      excuseTypeService.getExcuseTypes(),
    ]).then(([s, e]) => {
      if (!mounted) return;
      setStatuses(s);
      setExcuseTypes(e);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // ── Load players ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    setLoadingPlayers(true);
    teamplayerService.getPlayersByTeam(teamId).then((p) => {
      if (!mounted) return;
      setPlayers(p);
    }).catch(() => {
      if (mounted) setPlayers([]);
    }).finally(() => {
      if (mounted) setLoadingPlayers(false);
    });
    return () => { mounted = false; };
  }, [teamId]);

  // ── Load past match events and their convocations ─────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    setLoadingEvents(true);

    (async () => {
      try {
        // Resolve match event type ID dynamically from catalog
        let matchTypeIds = new Set<number>();
        try {
          const types = await sportEventTypeService.getSportEventTypes();
          types.forEach((t) => {
            const n = (t.name ?? "").toLowerCase();
            if (n.includes("partido") || n.includes("match") || n === "liga") {
              matchTypeIds.add(t.id);
            }
          });
        } catch { /* ignore, fall back to name-based check */ }

        // Fetch all past events (large page size to get all)
        const today = new Date().toISOString().split("T")[0];
        const resp = await sportEventService.getSportEvents(
          teamId,
          1,
          200,
          undefined,
          today,
          true // descending = most recent first
        );

        // Filter only match-type events that have already been played
        const matchEvents = resp.items.filter((ev) => {
          const typeId = ev.eventTypeId;
          const typeName = (ev.eventType ?? "").toLowerCase();
          const isMatchType =
            (typeId != null && matchTypeIds.has(typeId)) ||
            typeName.includes("partido") ||
            typeName.includes("match");
          const eventDate = ev.start ?? ev.eveDateTime ?? ev.startTime ?? "";
          const isPast = eventDate && eventDate < today + "T23:59:59";
          return isMatchType && isPast;
        });

        if (!mounted) return;

        const cols: MatchColumn[] = matchEvents.map((ev, idx) => {
          const d = ev.start ?? ev.eveDateTime ?? ev.startTime ?? "";
          return {
            eventId: ev.id,
            label: `J${matchEvents.length - idx} · ${shortDate(d)}`,
            date: d,
            rival: ev.rival ?? ev.name ?? ev.title ?? null,
          };
        });

        setMatchColumns(cols);

        if (cols.length === 0) {
          if (mounted) setLoadingEvents(false);
          return;
        }

        // Fetch convocations for each event in parallel
        setLoadingGrid(true);
        const results = await Promise.allSettled(
          cols.map((col) => convocationService.getConvocations(col.eventId))
        );

        if (!mounted) return;

        const newGrid = new Map<string, Map<string, GridCell>>();
        results.forEach((result, idx) => {
          const col = cols[idx];
          const playerMap = new Map<string, GridCell>();
          if (result.status === "fulfilled") {
            for (const conv of result.value) {
              const pid = conv.player.id ?? "";
              if (!pid) continue;
              playerMap.set(pid, {
                statusId: conv.status,
                excuseTypeId: conv.excuseTypeId ?? null,
                statusName: "", // filled after statuses load
                excuseName: null, // filled after excuseTypes load
              });
            }
          }
          newGrid.set(col.eventId, playerMap);
        });

        setGridData(newGrid);
      } catch {
        if (mounted) setMatchColumns([]);
      } finally {
        if (mounted) {
          setLoadingEvents(false);
          setLoadingGrid(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [teamId]);

  // ── Enrich grid cells with label names once catalogs arrive ───────────────
  const enrichedGrid = useMemo<Map<string, Map<string, GridCell>>>(() => {
    if (statusMap.size === 0) return gridData;
    const out = new Map<string, Map<string, GridCell>>();
    gridData.forEach((playerMap, eventId) => {
      const enriched = new Map<string, GridCell>();
      playerMap.forEach((cell, playerId) => {
        enriched.set(playerId, {
          ...cell,
          statusName: cell.statusId != null ? (statusMap.get(cell.statusId) ?? String(cell.statusId)) : "",
          excuseName: cell.excuseTypeId != null ? (excuseMap.get(cell.excuseTypeId) ?? null) : null,
        });
      });
      out.set(eventId, enriched);
    });
    return out;
  }, [gridData, statusMap, excuseMap]);

  const isLoading = loadingPlayers || loadingEvents || loadingGrid;

  // ── Find the internal sport event ID matching this match (for mgmt tab) ───
  useEffect(() => {
    if (!teamId || !match?.date) return;
    let mounted = true;
    (async () => {
      try {
        const types = await sportEventTypeService.getSportEventTypes().catch(() => []);
        const matchTypeIds = new Set<number>();
        types.forEach((t) => {
          const n = (t.name ?? "").toLowerCase();
          if (n.includes("partido") || n.includes("match") || n === "liga") {
            matchTypeIds.add(t.id);
          }
        });
        const resp = await sportEventService.getSportEvents(teamId, 1, 50, match.date, match.date);
        if (!mounted) return;
        const matchEvents = resp.items.filter((ev) => {
          if (matchTypeIds.size === 0) return true;
          const typeId = ev.eventTypeId;
          const typeName = (ev.eventType ?? "").toLowerCase();
          return (
            (typeId != null && matchTypeIds.has(typeId)) ||
            typeName.includes("partido") ||
            typeName.includes("match")
          );
        });
        const eventId = matchEvents[0]?.id ?? resp.items[0]?.id ?? null;
        if (mounted) setMgmtEventId(eventId);
      } catch {
        // silently fail — convocation management will show "no event" message
      }
    })();
    return () => { mounted = false; };
  }, [teamId, match?.date]);

  // ── Load convocations for current match event (mgmt tab) ──────────────────
  useEffect(() => {
    if (!mgmtEventId || players.length === 0) return;
    let mounted = true;
    setMgmtLoadingConv(true);
    (async () => {
      try {
        const convs = await convocationService.getConvocations(mgmtEventId);
        if (!mounted) return;
        const convMap: Record<string, string> = {};
        const calledIds: string[] = [];
        const notCalledIds: string[] = [];
        const noDispIds: string[] = [];
        // Players with availabilityTypeId=1 (confirmed available) go to the
        // disponibles pool; they have a convocation record but the coach
        // hasn't formally called them yet.
        const availFromConvIds: string[] = [];

        for (const conv of convs) {
          const pid = conv.player.id ?? "";
          if (!pid) continue;
          convMap[pid] = conv.id;

          // availabilityTypeId takes absolute priority over status codes
          if (conv.availabilityTypeId === 1) {
            // Player confirmed available; not yet formally selected by coach
            availFromConvIds.push(pid);
          } else if (conv.availabilityTypeId === 2) {
            noDispIds.push(pid);
          } else if (conv.status === NO_DISPONIBLE_STATUS_ID) {
            noDispIds.push(pid);
          } else if (NOT_CALLED_STATUS_IDS.has(conv.status)) {
            notCalledIds.push(pid);
          } else {
            // status=1 and no availabilityTypeId → coach explicitly called them
            calledIds.push(pid);
          }
        }
        const convocatedIds = new Set([...calledIds, ...notCalledIds, ...noDispIds, ...availFromConvIds]);
        const availableIds: string[] = [...availFromConvIds];
        const injuredNotCalled: string[] = [];
        for (const p of players) {
          if (convocatedIds.has(p.id)) continue;
          if (p.isInjured) injuredNotCalled.push(p.id);
          else availableIds.push(p.id);
        }
        if (mounted) {
          setMgmtConvMap(convMap);
          setMgmtCalled(calledIds);
          setMgmtNotCalled([...notCalledIds, ...injuredNotCalled]);
          setMgmtNoDisponible(noDispIds);
          setMgmtAvailable(availableIds);          // Restore existing excuse types from loaded convocations
          const excuseInit: Record<string, number | null> = {};
          for (const conv of convs) {
            const pid = conv.player.id ?? "";
            if (pid && conv.excuseTypeId != null) excuseInit[pid] = conv.excuseTypeId;
          }
          setMgmtExcuseMap(excuseInit);        }
      } catch {
        if (mounted) {
          const avail: string[] = [];
          const notC: string[] = [];
          for (const p of players) {
            if (p.isInjured) notC.push(p.id);
            else avail.push(p.id);
          }
          setMgmtAvailable(avail);
          setMgmtNotCalled(notC);
          setMgmtNoDisponible([]);
          setMgmtCalled([]);
          setMgmtConvMap({});
        }
      } finally {
        if (mounted) setMgmtLoadingConv(false);
      }
    })();
    return () => { mounted = false; };
  }, [mgmtEventId, players]);

  // ── Load ratings once we have a teamId ────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    playerRatingService.getTeamLatestRatings(teamId).then((data) => {
      if (!mounted) return;
      const map: Record<string, PlayerRating> = {};
      data.forEach((r) => { map[r.teamPlayerId] = r; });
      setMgmtRatings(map);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [teamId]);

  // ── Load player photos ────────────────────────────────────────────────────
  useEffect(() => {
    if (players.length === 0) return;
    let mounted = true;
    const created: string[] = [];
    (async () => {
      const photos: Record<string, string | null> = {};
      await Promise.all(
        players.map(async (p) => {
          try {
            if (p.urlPhoto) {
              const obj = await playerService.fetchPlayerPhoto(p.urlPhoto);
              photos[p.id] = obj;
              if (obj) created.push(obj);
            } else {
              photos[p.id] = null;
            }
          } catch {
            photos[p.id] = null;
          }
        })
      );
      if (mounted) setMgmtPhotos(photos);
    })();
    return () => {
      mounted = false;
      created.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
    };
  }, [players]);

  // ── Bulk save convocatoria ─────────────────────────────────────────────────
  async function handleSaveConvocatoria() {
    if (!mgmtEventId) return;
    setMgmtSaving(true);
    try {
      type Task = { pid: string; statusId: number; availId: number | null; excuseId?: number | null };
      const tasks: Task[] = [
        ...mgmtCalled.map((pid) => ({ pid, statusId: CALLED_STATUS_ID, availId: null as null })),
        ...mgmtNotCalled.map((pid) => ({ pid, statusId: NOT_CALLED_STATUS_ID, availId: null as null, excuseId: mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null })),
        ...mgmtNoDisponible.map((pid) => ({ pid, statusId: NO_DISPONIBLE_STATUS_ID, availId: null as null, excuseId: mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null })),
        ...mgmtAvailable.map((pid) => ({ pid, statusId: CALLED_STATUS_ID, availId: 1 as number })),
      ];

      // Validate: Declined/NoDisponible players must have an excuse
      const missingExcuse = tasks.filter((t) => (t.statusId === NOT_CALLED_STATUS_ID || t.statusId === NO_DISPONIBLE_STATUS_ID) && !t.excuseId);
      if (missingExcuse.length > 0) {
        const names = missingExcuse.map((t) => {
          const p = players.find((pl) => pl.id === t.pid);
          return p ? ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias : t.pid;
        });
        throw new Error(`Falta el motivo de desconvocatoria para: ${names.join(", ")}`);
      }

      // Process one by one to keep convMap in sync
      const updatedConvMap = { ...mgmtConvMap };
      for (const task of tasks) {
        const { pid, statusId, availId } = task;
        let convId = updatedConvMap[pid];
        if (!convId) {
          if (statusId === CALLED_STATUS_ID && availId === 1) {
            // Available players without a convocation record: nothing to persist
            continue;
          }
          const c = await convocationService.addConvocation(mgmtEventId, pid);
          convId = (c as any).id ?? (c as any).convocationId ?? "";
          if (convId) updatedConvMap[pid] = convId;
        }
        if (!convId) continue;
        await convocationService.updateConvocationStatus(mgmtEventId, convId, statusId, (task as any).excuseId ?? null);
        await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, availId);
      }

      setMgmtConvMap(updatedConvMap);
      setMgmtSaveResult("success");
    } catch (err: any) {
      setMgmtSaveResult(err?.message ?? "error");
    } finally {
      setMgmtSaving(false);
    }
  }

  // ── Team average rating for called players ────────────────────────────────
  const teamAvgRating = useMemo(() => {
    const withRating = mgmtCalled.filter((id) => mgmtRatings[id]);
    if (withRating.length === 0) return null;
    const sum = withRating.reduce((acc, id) => {
      const r = mgmtRatings[id];
      return acc + (r.technical + r.tactical + r.physical + r.competitiveness) / 4;
    }, 0);
    return sum / withRating.length;
  }, [mgmtCalled, mgmtRatings]);

  // ── Players for the Alineación tab (convocados only, IdealLineup format) ──
  const lineupPlayers = useMemo(() => {
    const calledSet = new Set(mgmtCalled);
    return players
      .filter((p) => calledSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias || "Jugador",
        alias: p.alias ?? null,
        photoSrc: mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: p.isInjured === true,
      }));
  }, [mgmtCalled, players, mgmtPhotos, mgmtRatings]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  function handleMgmtDragStart(playerId: string) {
    setMgmtDragPlayer(playerId);
  }

  async function handleMgmtDrop(zone: DropZone) {
    if (!mgmtDragPlayer || !mgmtEventId) return;
    const pid = mgmtDragPlayer;
    setMgmtDragPlayer(null);
    setMgmtDragOver(null);

    let from: DropZone;
    if (mgmtCalled.includes(pid)) from = "called";
    else if (mgmtNotCalled.includes(pid)) from = "notCalled";
    else if (mgmtNoDisponible.includes(pid)) from = "noDisponible";
    else from = "available";

    if (from === zone) return;

    // Optimistically update UI first, then call API
    setMgmtAvailable((prev) => zone === "available" ? [...prev, pid] : prev.filter((id) => id !== pid));
    setMgmtCalled((prev) => zone === "called" ? [...prev, pid] : prev.filter((id) => id !== pid));
    setMgmtNotCalled((prev) => zone === "notCalled" ? [...prev, pid] : prev.filter((id) => id !== pid));
    setMgmtNoDisponible((prev) => zone === "noDisponible" ? [...prev, pid] : prev.filter((id) => id !== pid));

    try {
      let convId = mgmtConvMap[pid];

      // Ensure convocation record exists for zones other than available
      if (zone !== "available" && !convId) {
        const c = await convocationService.addConvocation(mgmtEventId, pid);
        convId = (c as any).id ?? (c as any).convocationId ?? "";
        if (convId) setMgmtConvMap((prev) => ({ ...prev, [pid]: convId }));
      }

      if (zone === "available") {
        // Mark as available pool: set availabilityTypeId=1 so next reload puts
        // them back in Disponibles. If no convRecord yet, no API call needed.
        if (convId) {
          await convocationService.updateConvocationStatus(mgmtEventId, convId, CALLED_STATUS_ID);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, 1);
        }
      } else if (zone === "called") {
        // Formally called up: clear availabilityTypeId so reload maps them to Convocados
        if (convId) {
          await convocationService.updateConvocationStatus(mgmtEventId, convId, CALLED_STATUS_ID);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, null);
        }
      } else if (zone === "notCalled") {
        if (convId) {
          const excuseId = mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null;
          // Ensure we always have an excuseTypeId for Declined status
          if (!excuseId) throw new Error("Se requiere un tipo de excusa para desconvocar");
          setMgmtExcuseMap((prev) => ({ ...prev, [pid]: excuseId }));
          await convocationService.updateConvocationStatus(mgmtEventId, convId, NOT_CALLED_STATUS_ID, excuseId);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, null);
        }
      } else {
        // noDisponible
        if (convId) {
          const excuseId = mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null;
          if (!excuseId) throw new Error("Se requiere un tipo de excusa para marcar como no disponible");
          setMgmtExcuseMap((prev) => ({ ...prev, [pid]: excuseId }));
          await convocationService.updateConvocationStatus(mgmtEventId, convId, NO_DISPONIBLE_STATUS_ID, excuseId);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, null);
        }
      }
    } catch {
      // On API error, revert to previous zone
      setMgmtAvailable((prev) => from === "available" ? [...prev, pid] : prev.filter((id) => id !== pid));
      setMgmtCalled((prev) => from === "called" ? [...prev, pid] : prev.filter((id) => id !== pid));
      setMgmtNotCalled((prev) => from === "notCalled" ? [...prev, pid] : prev.filter((id) => id !== pid));
      setMgmtNoDisponible((prev) => from === "noDisponible" ? [...prev, pid] : prev.filter((id) => id !== pid));
    }
  }

  // ── Title / subtitle ──────────────────────────────────────────────────────
  const subtitle = match
    ? `${match.localTeamName} vs ${match.visitorTeamName} · ${match.date}`
    : "Partido";

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Convocatoria"
        subtitle={subtitle}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              variant="outlined"
              size="small"
            >
              Volver
            </Button>
            {tab === 0 && mgmtEventId && (
              <Button
                variant="contained"
                size="small"
                startIcon={mgmtSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                disabled={mgmtSaving}
                onClick={handleSaveConvocatoria}
              >
                Guardar
              </Button>
            )}
            {tab === 2 && mgmtEventId && mgmtCalled.length > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={lineupSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                disabled={lineupSaving}
                onClick={() => lineupRef.current?.save()}
              >
                Guardar
              </Button>
            )}
          </>
        }
      >
        {/* ── Match summary banner ── */}
        {match && (
          <div className={styles.matchBanner}>
            <div className={styles.bannerTeam}>
              {match.localTeamShield && (
                <img
                  src={match.localTeamShield}
                  alt=""
                  className={styles.bannerShield}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className={styles.bannerTeamName}>{match.localTeamName}</span>
            </div>

            <div className={styles.bannerCenter}>
              <span className={styles.bannerTime}>{match.time || "--:--"}</span>
              <span className={styles.bannerKickoff}>kick-off</span>
            </div>

            <div className={`${styles.bannerTeam} ${styles.bannerTeamRight}`}>
              {match.visitorTeamShield && (
                <img
                  src={match.visitorTeamShield}
                  alt=""
                  className={styles.bannerShield}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className={styles.bannerTeamName}>{match.visitorTeamName}</span>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          indicatorColor="secondary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", px: 1 }}
        >
          <Tab label="Convocatoria" />
          <Tab label="Desconvocatorias" />
          <Tab label="Alineación" />
        </Tabs>

        {/* ── Tab 0: Convocatoria management (drag & drop) ── */}
        {tab === 0 && (
          <div className={styles.convocatoriaTab}>
            {mgmtLoadingConv || loadingPlayers ? (
              <div className={styles.center}>
                <CircularProgress size={32} />
              </div>
            ) : !mgmtEventId ? (
              <div className={styles.center}>
                <EmptyState description="No se encontró el partido en el sistema interno. Asegúrate de que el evento esté creado en el área de Partidos del equipo." />
              </div>
            ) : (
              <>
                {/* Team average bar + Save button */}
                <div className={styles.teamAvgBar}>
                  <span className={styles.teamAvgLabel}>Media del equipo convocado</span>
                  {teamAvgRating != null ? (
                    <span
                      className={styles.teamAvgValue}
                      style={{ color: mgmtRatingColor(teamAvgRating) }}
                    >
                      {teamAvgRating.toFixed(1)}
                    </span>
                  ) : (
                    <span className={styles.teamAvgCount}>Sin valoraciones</span>
                  )}
                  <span className={styles.teamAvgCount}>
                    {mgmtCalled.length} convocado{mgmtCalled.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Four drop zones */}
                <div className={styles.dropColumns}>
                  {(["available", "called", "notCalled", "noDisponible"] as const).map((zone) => {
                    const ids =
                      zone === "available"
                        ? mgmtAvailable
                        : zone === "called"
                        ? mgmtCalled
                        : zone === "notCalled"
                        ? mgmtNotCalled
                        : mgmtNoDisponible;
                    const headerClass =
                      zone === "available"
                        ? styles.dropColumnHeaderAvailable
                        : zone === "called"
                        ? styles.dropColumnHeaderCalled
                        : zone === "notCalled"
                        ? styles.dropColumnHeaderNotCalled
                        : styles.dropColumnHeaderNoDisponible;
                    const label =
                      zone === "available"
                        ? "Disponibles"
                        : zone === "called"
                        ? "Convocados"
                        : zone === "notCalled"
                        ? "Desconvocados"
                        : "No disponibles";

                    return (
                      <div
                        key={zone}
                        className={`${styles.dropColumn} ${mgmtDragOver === zone ? styles.dropColumnOver : ""}`}
                        onDragOver={(e) => { e.preventDefault(); setMgmtDragOver(zone); }}
                        onDragLeave={() => setMgmtDragOver(null)}
                        onDrop={(e) => { e.preventDefault(); handleMgmtDrop(zone); }}
                      >
                        <div className={`${styles.dropColumnHeader} ${headerClass}`}>
                          <span>{label}</span>
                          <span className={styles.dropColumnCount}>{ids.length}</span>
                        </div>
                        <div className={styles.dropColumnBody}>
                          {ids.length === 0 && (
                            <div className={styles.dropHint}>
                              Arrastra jugadores aquí
                            </div>
                          )}
                          {(() => {
                            const GROUPS = [
                              { order: 0, label: "Porteros" },
                              { order: 1, label: "Defensas" },
                              { order: 2, label: "Medios" },
                              { order: 3, label: "Delanteros" },
                              { order: 4, label: "Sin posición" },
                            ];
                            const sorted = [...ids].sort((a, b) => {
                              const pa = players.find((pl) => pl.id === a)?.position ?? "";
                              const pb = players.find((pl) => pl.id === b)?.position ?? "";
                              return positionOrder(pa) - positionOrder(pb);
                            });
                            return GROUPS.flatMap(({ order, label }) => {
                              const group = sorted.filter((pid) => {
                                const pos = players.find((pl) => pl.id === pid)?.position ?? "";
                                return positionOrder(pos) === order;
                              });
                              if (group.length === 0) return [];
                              return [
                                <div key={`group-${order}`} className={styles.positionGroupLabel}>{label}</div>,
                                ...group.map((playerId) => {
                                  const p = players.find((pl) => pl.id === playerId);
                                  if (!p) return null;
                                  const displayName =
                                    ((p.name ?? "") + " " + (p.lastName ?? "")).trim() ||
                                    p.alias ||
                                    "Jugador";
                                  const r = mgmtRatings[playerId];
                                  return (
                                    <div
                                      key={playerId}
                                      draggable
                                      className={`${styles.draggableCard} ${mgmtDragPlayer === playerId ? styles.draggableCardDragging : ""}`}
                                      onDragStart={() => handleMgmtDragStart(playerId)}
                                      onDragEnd={() => {
                                        setMgmtDragPlayer(null);
                                        setMgmtDragOver(null);
                                      }}
                                    >
                                      <PlayerCromo
                                        displayName={displayName}
                                        photoSrc={mgmtPhotos[playerId] ?? null}
                                        dorsal={p.dorsal ?? null}
                                        position={p.position ?? null}
                                        injured={p.isInjured === true}
                                        rating={
                                          r
                                            ? {
                                                technical: r.technical,
                                                tactical: r.tactical,
                                                physical: r.physical,
                                                competitiveness: r.competitiveness,
                                              }
                                            : null
                                        }
                                      />
                                      {(zone === "notCalled" || zone === "noDisponible") && excuseTypes.length > 0 && (
                                        <FormControl
                                          size="small"
                                          fullWidth
                                          sx={{ mt: 0.5 }}
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onDragStart={(e) => e.stopPropagation()}
                                        >
                                          <InputLabel sx={{ fontSize: "0.7rem" }}>Motivo</InputLabel>
                                          <Select
                                            label="Motivo"
                                            value={mgmtExcuseMap[playerId] ?? ""}
                                            onChange={(e) => {
                                              const val = e.target.value as number;
                                              setMgmtExcuseMap((prev) => ({ ...prev, [playerId]: val }));
                                            }}
                                            sx={{ fontSize: "0.72rem" }}
                                          >
                                            {excuseTypes.map((et) => (
                                              <MenuItem key={et.id} value={et.id} sx={{ fontSize: "0.72rem" }}>
                                                {et.name}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </FormControl>
                                      )}
                                    </div>
                                  );
                                }),
                              ];
                            });
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Save result snackbar ── */}
        <Snackbar
          open={mgmtSaveResult !== null}
          autoHideDuration={4500}
          onClose={() => setMgmtSaveResult(null)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          TransitionComponent={(props) => <Slide {...props} direction="down" />}
        >
          <Alert
            severity={mgmtSaveResult === "success" ? "success" : "error"}
            onClose={() => setMgmtSaveResult(null)}
            sx={{ width: "100%" }}
          >
            {mgmtSaveResult === "success"
              ? "Convocatoria guardada correctamente"
              : mgmtSaveResult ?? "Error al guardar la convocatoria. Inténtalo de nuevo."}
          </Alert>
        </Snackbar>

        {/* ── Tab 1: Desconvocatorias grid ── */}
        {tab === 1 && (
          <div className={styles.tabContent}>
            {isLoading ? (
              <div className={styles.center}>
                <CircularProgress />
              </div>
            ) : matchColumns.length === 0 ? (
              <div className={styles.center}>
                <EmptyState
                  description={
                    teamId
                      ? "Aún no hay partidos registrados con asistencias. Esta cuadrícula se completará automáticamente cuando se registren los partidos jugados y sus convocatorias."
                      : "No se ha encontrado el equipo. Accede desde el Dashboard seleccionando un equipo."
                  }
                />
              </div>
            ) : (
              <div className={styles.gridWrapper}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      {/* Player name column header */}
                      <th className={`${styles.th} ${styles.playerCol}`}>Jugador</th>
                      {matchColumns.map((col) => (
                        <th key={col.eventId} className={styles.th}>
                          <Tooltip title={col.rival ?? col.date} placement="top">
                            <span className={styles.colLabel}>{col.label}</span>
                          </Tooltip>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id} className={styles.row}>
                        <td className={`${styles.td} ${styles.playerCell}`}>
                          <span className={styles.playerName}>
                            {player.alias || player.name}
                          </span>
                        </td>
                        {matchColumns.map((col) => {
                          const cell = enrichedGrid.get(col.eventId)?.get(player.id);
                          const isAbsent = cell && cell.statusId !== null && NOT_CALLED_STATUS_IDS.has(cell.statusId);
                          return (
                            <td
                              key={col.eventId}
                              className={`${styles.td} ${styles.dataCell} ${cellColor(cell)}`}
                            >
                              <Tooltip
                                title={
                                  cell
                                    ? `${cell.statusName}${cell.excuseName ? ` · ${cell.excuseName}` : ""}`
                                    : "Sin registro"
                                }
                                placement="top"
                              >
                                <span className={styles.cellContent}>
                                  {isAbsent
                                    ? (cell?.excuseName
                                        ? cell.excuseName.slice(0, 8)
                                        : "✗")
                                    : cell
                                    ? "✓"
                                    : ""}
                                </span>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Alineación ── */}
        {tab === 2 && (
          <div className={styles.tabContent}>
            {!mgmtEventId ? (
              <div className={styles.center}>
                <EmptyState description="No se encontró el partido en el sistema interno." />
              </div>
            ) : mgmtCalled.length === 0 ? (
              <div className={styles.center}>
                <EmptyState description="Aún no hay jugadores convocados. Convoca jugadores primero en la pestaña 'Convocatoria'." />
              </div>
            ) : (
              <IdealLineup
                ref={lineupRef}
                players={lineupPlayers}
                teamId={teamId}
                seasonId={mgmtEventId}
                panelTitle="Banquillo"
                hideInternalSave
                onSavingChange={setLineupSaving}
              />
            )}
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
