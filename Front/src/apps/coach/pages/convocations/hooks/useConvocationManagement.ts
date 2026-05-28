import { useEffect, useState, useMemo } from "react";
import convocationService from "../../../services/convocationService";
import excuseTypeService, { type ExcuseType } from "../../../services/excuseTypeService";
import convocationStatusService, {
  type ConvocationStatus,
} from "../../../services/convocationStatusService";
import playerRatingService from "../../../services/playerRatingService";
import playerService from "../../../services/playerService";
import teamplayerService, { type PlayerResponse } from "../../../services/teamplayerService";
import sportEventService from "../../../services/sportEventService";
import sportEventTypeService from "../../../services/sportEventTypeService";
import type { PlayerRating } from "../../../types/playerRating";
import type { DropZone } from "../components/convocationMatchDetail.types";
import {
  CALLED_STATUS_ID,
  CALLED_STATUS_IDS,
  NOT_CALLED_STATUS_ID,
  JUSTIFIED_STATUS_ID,
  PENDING_STATUS_ID,
} from "../components/convocationMatchDetail.types";

// Returns true only if the injury started strictly before the given event date (day-only comparison).
// A player injured on the same day as the event is NOT considered injured for that event.
function isInjuredBeforeDate(injuryStartDate: string | null | undefined, eventDate: string | undefined): boolean {
  if (!injuryStartDate) return true; // no start date info → treat as injured (safe fallback)
  if (!eventDate) return true;
  const injDay = injuryStartDate.slice(0, 10); // "YYYY-MM-DD"
  const evDay = eventDate.slice(0, 10);
  return injDay < evDay;
}

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
  mgmtPending: string[];
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
  moveToNotCalled: (playerId: string, excuseId?: number | null) => Promise<void>;
  moveToAvailable: (playerId: string) => Promise<void>;
  acceptPending: (playerId: string) => Promise<void>;
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
  const [mgmtPending, setMgmtPending] = useState<string[]>([]);
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
        const pendingIds: string[] = [];

        for (const conv of convs) {
          const pid = conv.player.id ?? "";
          if (!pid) continue;
          convMap[pid] = conv.id;
          // Status 5 (Deconvoke) and 4 (Justified) → not called; 1 (Pending) and 2 (Accepted) → called
          if (conv.status === NOT_CALLED_STATUS_ID || conv.status === JUSTIFIED_STATUS_ID) {
            notCalledIds.push(pid);
          } else {
            calledIds.push(pid);
            if (conv.status === PENDING_STATUS_ID) pendingIds.push(pid);
          }
        }

        // Move injured players from calledIds to notCalledIds
        const injuredCalledIds = new Set<string>();
        for (const p of players) {
          const injuredForMatch = p.isInjured && isInjuredBeforeDate(p.injuryStartDate, matchDate);
          if (injuredForMatch) injuredCalledIds.add(p.id);
        }
        const finalCalledIds = calledIds.filter((id) => !injuredCalledIds.has(id));
        for (const id of calledIds) {
          if (injuredCalledIds.has(id)) notCalledIds.push(id);
        }

        const convocatedIds = new Set([
          ...finalCalledIds,
          ...notCalledIds,
        ]);
        const availableIds: string[] = [];
        for (const p of players) {
          if (convocatedIds.has(p.id)) continue;
          const injuredForMatch = injuredCalledIds.has(p.id);
          if (injuredForMatch) {
            notCalledIds.push(p.id);
          } else {
            availableIds.push(p.id);
          }
        }

        const excuseInit: Record<string, number | null> = {};
        for (const conv of convs) {
          const pid = conv.player.id ?? "";
          if (pid && conv.excuseTypeId != null) excuseInit[pid] = conv.excuseTypeId;
        }

        // Injured players that have no excuse yet → default to "Injury" (id 1)
        for (const pid of injuredCalledIds) {
          if (excuseInit[pid] == null) excuseInit[pid] = 1;
        }

        if (mounted) {
          setMgmtConvMap(convMap);
          setMgmtCalled(finalCalledIds);
          setMgmtNotCalled(notCalledIds);
          setMgmtPending(pendingIds.filter((id) => !injuredCalledIds.has(id)));
          setMgmtAvailable(availableIds);
          setMgmtExcuseMap(excuseInit);
        }
      } catch {
        if (mounted) {
          const avail: string[] = [];
          const noDisp: string[] = [];
          const excuseFallback: Record<string, number | null> = {};
          for (const p of players) {
            const injuredForMatch = p.isInjured && isInjuredBeforeDate(p.injuryStartDate, matchDate);
            if (injuredForMatch) {
              noDisp.push(p.id);
              excuseFallback[p.id] = 1;
            } else avail.push(p.id);
          }
          setMgmtAvailable(avail);
          setMgmtNotCalled(noDisp);
          setMgmtCalled([]);
          setMgmtConvMap({});
          setMgmtExcuseMap(excuseFallback);
        }
      } finally {
        if (mounted) setMgmtLoadingConv(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mgmtEventId, players]);

  // ── Patch missing excuses for injured players ────────────────────────────
  // Only injured players without a saved excuse get defaulted to "Injury" (id 1).
  // Non-injured players keep whatever was saved in DB (or stay empty for technical decisions).
  useEffect(() => {
    if (mgmtNotCalled.length === 0) return;
    setMgmtExcuseMap((prev) => {
      const patch: Record<string, number | null> = {};
      for (const pid of mgmtNotCalled) {
        if (prev[pid] != null) continue; // already has a value — don't overwrite
        const p = players.find((pl) => pl.id === pid);
        const injuredForMatch = p?.isInjured && isInjuredBeforeDate(p.injuryStartDate, matchDate);
        if (injuredForMatch) patch[pid] = 1;
        // non-injured with no DB value → leave empty (technical decision)
      }
      if (Object.keys(patch).length === 0) return prev;
      return { ...prev, ...patch };
    });
  }, [mgmtNotCalled, players, matchDate]);

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
    else from = "available";

    if (from === zone) return;

    setMgmtAvailable((prev) => (zone === "available" ? [...prev, pid] : prev.filter((id) => id !== pid)));
    setMgmtCalled((prev) => (zone === "called" ? [...prev, pid] : prev.filter((id) => id !== pid)));
    setMgmtNotCalled((prev) => (zone === "notCalled" ? [...prev, pid] : prev.filter((id) => id !== pid)));

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
        }
      } else if (zone === "called") {
        if (convId) {
          await convocationService.updateConvocationStatus(mgmtEventId, convId, CALLED_STATUS_ID);
        }
      } else if (zone === "notCalled") {
        if (convId) {
          const excuseId = mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null;
          if (!excuseId) throw new Error("Se requiere un tipo de excusa para desconvocar");
          setMgmtExcuseMap((prev) => ({ ...prev, [pid]: excuseId }));
          await convocationService.updateConvocationStatus(mgmtEventId, convId, NOT_CALLED_STATUS_ID, excuseId);
        }
      }
    } catch {
      setMgmtAvailable((prev) => (from === "available" ? [...prev, pid] : prev.filter((id) => id !== pid)));
      setMgmtCalled((prev) => (from === "called" ? [...prev, pid] : prev.filter((id) => id !== pid)));
      setMgmtNotCalled((prev) => (from === "notCalled" ? [...prev, pid] : prev.filter((id) => id !== pid)));
    }
  }

  // Global cleanup: ensure native drag/pointer events clear the drag state
  // This helps recover from interrupted drags and avoids leaving the UI
  // in a state where no further drags are possible until reload.
  useEffect(() => {
    const cleanup = () => {
      setMgmtDragPlayer(null);
      setMgmtDragOver(null);
    };
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("dragend", cleanup);
    window.addEventListener("touchend", cleanup);
    return () => {
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("dragend", cleanup);
      window.removeEventListener("touchend", cleanup);
    };
  }, []);

  async function handleSave() {
    if (!mgmtEventId) return;
    setMgmtSaving(true);
    try {
      type Task = {
        pid: string;
        statusId: number;
        excuseId?: number | null;
      };
      const tasks: Task[] = [
        ...mgmtCalled.map((pid) => ({ pid, statusId: CALLED_STATUS_ID })),
        ...mgmtNotCalled.map((pid) => ({
          pid,
          statusId: NOT_CALLED_STATUS_ID,
          excuseId: mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null,
        })),
        ...mgmtAvailable.map((pid) => ({ pid, statusId: CALLED_STATUS_ID })),
      ];

      const missingExcuse = tasks.filter(
        (t) =>
          t.statusId === NOT_CALLED_STATUS_ID &&
          !t.excuseId
      );
      if (missingExcuse.length > 0) {
        const names = missingExcuse.map((t) => {
          const p = players.find((pl) => pl.id === t.pid);
          return p ? p.alias || ((p.name ?? "") + " " + (p.lastName ?? "")).trim() || t.pid : t.pid;
        });
        throw new Error(`Falta el motivo de desconvocatoria para: ${names.join(", ")}`);
      }

      const updatedConvMap = { ...mgmtConvMap };
      for (const task of tasks) {
        const { pid, statusId } = task;
        let convId = updatedConvMap[pid];
        if (!convId) {
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
      }

      setMgmtConvMap(updatedConvMap);
      setMgmtSaveResult("success");
    } catch (err: any) {
      setMgmtSaveResult(err?.message ?? "error");
    } finally {
      setMgmtSaving(false);
    }
  }

  async function moveToNotCalled(playerId: string, excuseId?: number | null) {
    if (!mgmtEventId) return;
    const pid = playerId;
    const resolvedExcuse = excuseId ?? mgmtExcuseMap[pid] ?? excuseTypes[0]?.id ?? null;

    // Optimistic update
    setMgmtAvailable((prev) => prev.filter((id) => id !== pid));
    setMgmtCalled((prev) => prev.filter((id) => id !== pid));
    setMgmtNotCalled((prev) => (prev.includes(pid) ? prev : [...prev, pid]));
    if (resolvedExcuse) setMgmtExcuseMap((prev) => ({ ...prev, [pid]: resolvedExcuse }));

    try {
      let convId = mgmtConvMap[pid];
      if (!convId) {
        const c = await convocationService.addConvocation(mgmtEventId, pid);
        convId = (c as any).id ?? (c as any).convocationId ?? "";
        if (convId) setMgmtConvMap((prev) => ({ ...prev, [pid]: convId }));
      }
      if (convId && resolvedExcuse) {
        await convocationService.updateConvocationStatus(mgmtEventId, convId, NOT_CALLED_STATUS_ID, resolvedExcuse);
      }
    } catch {
      // rollback optimistic update
      setMgmtNotCalled((prev) => prev.filter((id) => id !== pid));
    }
  }

  async function moveToAvailable(playerId: string) {
    if (!mgmtEventId) return;
    const pid = playerId;

    // Optimistic update: remove from notCalled, add to available
    setMgmtNotCalled((prev) => prev.filter((id) => id !== pid));
    setMgmtAvailable((prev) => (prev.includes(pid) ? prev : [...prev, pid]));

    try {
      const convId = mgmtConvMap[pid];
      if (convId) {
        await convocationService.updateConvocationStatus(mgmtEventId, convId, CALLED_STATUS_ID);
      }
    } catch {
      // rollback
      setMgmtAvailable((prev) => prev.filter((id) => id !== pid));
      setMgmtNotCalled((prev) => (prev.includes(pid) ? prev : [...prev, pid]));
    }
  }

  async function acceptPending(playerId: string) {
    if (!mgmtEventId) return;
    const pid = playerId;

    // Optimistic update: remove from pending, keep in called
    setMgmtPending((prev) => prev.filter((id) => id !== pid));

    try {
      const convId = mgmtConvMap[pid];
      if (convId) {
        await convocationService.updateConvocationStatus(mgmtEventId, convId, CALLED_STATUS_ID);
      }
    } catch {
      // rollback
      setMgmtPending((prev) => (prev.includes(pid) ? prev : [...prev, pid]));
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
    mgmtPending,
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
    moveToNotCalled,
    moveToAvailable,
    acceptPending,
  };
}
