import { useEffect, useState, useMemo } from "react";
import convocationService from "../../../services/convocationService";
import excuseTypeService, { type ExcuseType } from "../../../services/excuseTypeService";
import convocationStatusService, {
  type ConvocationStatus,
} from "../../../services/convocationStatusService";
import playerRatingService from "../../../services/playerRatingService";
import playerService from "../../../services/playerService";
import teamplayerService, { type PlayerResponse } from "../../../services/teamplayerService";
import availabilityTypeService from "../../../services/availabilityTypeService";
import sportEventService from "../../../services/sportEventService";
import sportEventTypeService from "../../../services/sportEventTypeService";
import type { PlayerRating } from "../../../types/playerRating";
import type { DropZone } from "../components/convocationMatchDetail.types";
import {
  NOT_CALLED_STATUS_IDS,
  CALLED_STATUS_ID,
  NOT_CALLED_STATUS_ID,
  NO_DISPONIBLE_STATUS_ID,
} from "../components/convocationMatchDetail.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConvocationManagementReturn = {
  // Players
  players: PlayerResponse[];
  loadingPlayers: boolean;
  // Catalogs
  excuseTypes: ExcuseType[];
  statuses: ConvocationStatus[];
  // Event resolution
  mgmtEventId: string | null;
  // Loading
  mgmtLoadingConv: boolean;
  // Zone lists
  mgmtAvailable: string[];
  mgmtCalled: string[];
  mgmtNotCalled: string[];
  mgmtNoDisponible: string[];
  // Supporting maps
  mgmtConvMap: Record<string, string>;
  mgmtRatings: Record<string, PlayerRating>;
  mgmtPhotos: Record<string, string | null>;
  mgmtExcuseMap: Record<string, number | null>;
  // Drag state
  mgmtDragPlayer: string | null;
  mgmtDragOver: DropZone | null;
  // Save state
  mgmtSaving: boolean;
  mgmtSaveResult: string | null;
  // Derived
  teamAvgRating: number | null;
  // Setters / handlers
  setMgmtDragOver: (zone: DropZone | null) => void;
  setMgmtSaveResult: (v: string | null) => void;
  setMgmtExcuseMap: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
  handleDragStart: (playerId: string) => void;
  handleDrop: (zone: DropZone) => void;
  handleSave: () => Promise<void>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConvocationManagement(
  teamId: string,
  matchDate: string | undefined
): ConvocationManagementReturn {
  // Players
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Catalogs
  const [statuses, setStatuses] = useState<ConvocationStatus[]>([]);
  const [excuseTypes, setExcuseTypes] = useState<ExcuseType[]>([]);

  // Event
  const [mgmtEventId, setMgmtEventId] = useState<string | null>(null);

  // Convocation state
  const [mgmtLoadingConv, setMgmtLoadingConv] = useState(false);
  const [mgmtAvailable, setMgmtAvailable] = useState<string[]>([]);
  const [mgmtCalled, setMgmtCalled] = useState<string[]>([]);
  const [mgmtNotCalled, setMgmtNotCalled] = useState<string[]>([]);
  const [mgmtNoDisponible, setMgmtNoDisponible] = useState<string[]>([]);
  const [mgmtConvMap, setMgmtConvMap] = useState<Record<string, string>>({});
  const [mgmtRatings, setMgmtRatings] = useState<Record<string, PlayerRating>>({});
  const [mgmtPhotos, setMgmtPhotos] = useState<Record<string, string | null>>({});
  const [mgmtExcuseMap, setMgmtExcuseMap] = useState<Record<string, number | null>>({});

  // Drag state
  const [mgmtDragPlayer, setMgmtDragPlayer] = useState<string | null>(null);
  const [mgmtDragOver, setMgmtDragOver] = useState<DropZone | null>(null);

  // Save state
  const [mgmtSaving, setMgmtSaving] = useState(false);
  const [mgmtSaveResult, setMgmtSaveResult] = useState<string | null>(null);

  // ── Load catalogs ────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    Promise.all([
      convocationStatusService.getConvocationStatuses(),
      excuseTypeService.getExcuseTypes(),
    ])
      .then(([s, e]) => {
        if (!mounted) return;
        setStatuses(s);
        setExcuseTypes(e);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // ── Load players ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    setLoadingPlayers(true);
    teamplayerService
      .getPlayersByTeam(teamId)
      .then((p) => {
        if (mounted) setPlayers(p);
      })
      .catch(() => {
        if (mounted) setPlayers([]);
      })
      .finally(() => {
        if (mounted) setLoadingPlayers(false);
      });
    return () => {
      mounted = false;
    };
  }, [teamId]);

  // ── Resolve sport event ID for this match ────────────────────────────────
  useEffect(() => {
    if (!teamId || !matchDate) return;
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
        const resp = await sportEventService.getSportEvents(teamId, 1, 50, matchDate, matchDate);
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
        /* silently fail */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teamId, matchDate]);

  // ── Load convocations for event ──────────────────────────────────────────
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
        const availFromConvIds: string[] = [];

        for (const conv of convs) {
          const pid = conv.player.id ?? "";
          if (!pid) continue;
          convMap[pid] = conv.id;
          if (conv.availabilityTypeId === 1) {
            availFromConvIds.push(pid);
          } else if (conv.availabilityTypeId === 2) {
            noDispIds.push(pid);
          } else if (conv.status === NO_DISPONIBLE_STATUS_ID) {
            noDispIds.push(pid);
          } else if (NOT_CALLED_STATUS_IDS.has(conv.status)) {
            notCalledIds.push(pid);
          } else {
            calledIds.push(pid);
          }
        }

        const convocatedIds = new Set([
          ...calledIds,
          ...notCalledIds,
          ...noDispIds,
          ...availFromConvIds,
        ]);
        const availableIds: string[] = [...availFromConvIds];
        const injuredNoDisp: string[] = [];
        for (const p of players) {
          if (convocatedIds.has(p.id)) continue;
          if (p.isInjured) injuredNoDisp.push(p.id);
          else availableIds.push(p.id);
        }

        const excuseInit: Record<string, number | null> = {};
        for (const conv of convs) {
          const pid = conv.player.id ?? "";
          if (pid && conv.excuseTypeId != null) excuseInit[pid] = conv.excuseTypeId;
        }

        if (mounted) {
          setMgmtConvMap(convMap);
          setMgmtCalled(calledIds);
          setMgmtNotCalled(notCalledIds);
          setMgmtNoDisponible([...noDispIds, ...injuredNoDisp]);
          setMgmtAvailable(availableIds);
          setMgmtExcuseMap(excuseInit);
        }
      } catch {
        if (mounted) {
          const avail: string[] = [];
          const noDisp: string[] = [];
          for (const p of players) {
            if (p.isInjured) noDisp.push(p.id);
            else avail.push(p.id);
          }
          setMgmtAvailable(avail);
          setMgmtNotCalled([]);
          setMgmtNoDisponible(noDisp);
          setMgmtNoDisponible([]);
          setMgmtCalled([]);
          setMgmtConvMap({});
        }
      } finally {
        if (mounted) setMgmtLoadingConv(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mgmtEventId, players]);

  // ── Load ratings ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    playerRatingService
      .getTeamLatestRatings(teamId)
      .then((data) => {
        if (!mounted) return;
        const map: Record<string, PlayerRating> = {};
        data.forEach((r) => {
          map[r.teamPlayerId] = r;
        });
        setMgmtRatings(map);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [teamId]);

  // ── Load player photos ───────────────────────────────────────────────────
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
      created.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
  }, [players]);

  // ── Derived: team average rating ─────────────────────────────────────────
  const teamAvgRating = useMemo(() => {
    const withRating = mgmtCalled.filter((id) => mgmtRatings[id]);
    if (withRating.length === 0) return null;
    const sum = withRating.reduce((acc, id) => {
      const r = mgmtRatings[id];
      return acc + (r.technical + r.tactical + r.physical + r.competitiveness) / 4;
    }, 0);
    return sum / withRating.length;
  }, [mgmtCalled, mgmtRatings]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleDragStart(playerId: string) {
    setMgmtDragPlayer(playerId);
  }

  async function handleDrop(zone: DropZone) {
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

    setMgmtAvailable((prev) => (zone === "available" ? [...prev, pid] : prev.filter((id) => id !== pid)));
    setMgmtCalled((prev) => (zone === "called" ? [...prev, pid] : prev.filter((id) => id !== pid)));
    setMgmtNotCalled((prev) => (zone === "notCalled" ? [...prev, pid] : prev.filter((id) => id !== pid)));
    setMgmtNoDisponible((prev) => (zone === "noDisponible" ? [...prev, pid] : prev.filter((id) => id !== pid)));

    try {
      let convId = mgmtConvMap[pid];
      if (zone !== "available" && !convId) {
        const c = await convocationService.addConvocation(mgmtEventId, pid);
        convId = (c as any).id ?? (c as any).convocationId ?? "";
        if (convId) setMgmtConvMap((prev) => ({ ...prev, [pid]: convId }));
      }

      if (zone === "available") {
        if (convId) {
          await convocationService.updateConvocationStatus(mgmtEventId, convId, CALLED_STATUS_ID);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, 1);
        }
      } else if (zone === "called") {
        if (convId) {
          await convocationService.updateConvocationStatus(mgmtEventId, convId, CALLED_STATUS_ID);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, null);
        }
      } else if (zone === "notCalled") {
        if (convId) {
          const excuseId = mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null;
          if (!excuseId) throw new Error("Se requiere un tipo de excusa para desconvocar");
          setMgmtExcuseMap((prev) => ({ ...prev, [pid]: excuseId }));
          await convocationService.updateConvocationStatus(mgmtEventId, convId, NOT_CALLED_STATUS_ID, excuseId);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, null);
        }
      } else {
        if (convId) {
          const excuseId = mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null;
          if (!excuseId) throw new Error("Se requiere un tipo de excusa para marcar como no disponible");
          setMgmtExcuseMap((prev) => ({ ...prev, [pid]: excuseId }));
          await convocationService.updateConvocationStatus(mgmtEventId, convId, NO_DISPONIBLE_STATUS_ID, excuseId);
          await availabilityTypeService.updateConvocationAvailability(mgmtEventId, convId, null);
        }
      }
    } catch {
      setMgmtAvailable((prev) => (from === "available" ? [...prev, pid] : prev.filter((id) => id !== pid)));
      setMgmtCalled((prev) => (from === "called" ? [...prev, pid] : prev.filter((id) => id !== pid)));
      setMgmtNotCalled((prev) => (from === "notCalled" ? [...prev, pid] : prev.filter((id) => id !== pid)));
      setMgmtNoDisponible((prev) => (from === "noDisponible" ? [...prev, pid] : prev.filter((id) => id !== pid)));
    }
  }

  async function handleSave() {
    if (!mgmtEventId) return;
    setMgmtSaving(true);
    try {
      type Task = {
        pid: string;
        statusId: number;
        availId: number | null;
        excuseId?: number | null;
      };
      const tasks: Task[] = [
        ...mgmtCalled.map((pid) => ({ pid, statusId: CALLED_STATUS_ID, availId: null as null })),
        ...mgmtNotCalled.map((pid) => ({
          pid,
          statusId: NOT_CALLED_STATUS_ID,
          availId: null as null,
          excuseId: mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null,
        })),
        ...mgmtNoDisponible.map((pid) => ({
          pid,
          statusId: NO_DISPONIBLE_STATUS_ID,
          availId: null as null,
          excuseId: mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null,
        })),
        ...mgmtAvailable.map((pid) => ({ pid, statusId: CALLED_STATUS_ID, availId: 1 as number })),
      ];

      const missingExcuse = tasks.filter(
        (t) =>
          (t.statusId === NOT_CALLED_STATUS_ID || t.statusId === NO_DISPONIBLE_STATUS_ID) &&
          !t.excuseId
      );
      if (missingExcuse.length > 0) {
        const names = missingExcuse.map((t) => {
          const p = players.find((pl) => pl.id === t.pid);
          return p ? ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || p.alias : t.pid;
        });
        throw new Error(`Falta el motivo de desconvocatoria para: ${names.join(", ")}`);
      }

      const updatedConvMap = { ...mgmtConvMap };
      for (const task of tasks) {
        const { pid, statusId, availId } = task;
        let convId = updatedConvMap[pid];
        if (!convId) {
          if (statusId === CALLED_STATUS_ID && availId === 1) continue;
          const c = await convocationService.addConvocation(mgmtEventId, pid);
          convId = (c as any).id ?? (c as any).convocationId ?? "";
          if (convId) updatedConvMap[pid] = convId;
        }
        if (!convId) continue;
        await convocationService.updateConvocationStatus(
          mgmtEventId,
          convId,
          statusId,
          (task as any).excuseId ?? null
        );
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

  return {
    players,
    loadingPlayers,
    excuseTypes,
    statuses,
    mgmtEventId,
    mgmtLoadingConv,
    mgmtAvailable,
    mgmtCalled,
    mgmtNotCalled,
    mgmtNoDisponible,
    mgmtConvMap,
    mgmtRatings,
    mgmtPhotos,
    mgmtExcuseMap,
    mgmtDragPlayer,
    mgmtDragOver,
    mgmtSaving,
    mgmtSaveResult,
    teamAvgRating,
    setMgmtDragOver,
    setMgmtSaveResult,
    setMgmtExcuseMap,
    handleDragStart,
    handleDrop,
    handleSave,
  };
}
