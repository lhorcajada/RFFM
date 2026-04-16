import { useEffect, useState, useMemo } from "react";
import convocationService from "../../../services/convocationService";
import convocationStatusService, {
  type ConvocationStatus,
} from "../../../services/convocationStatusService";
import excuseTypeService, { type ExcuseType } from "../../../services/excuseTypeService";
import sportEventService from "../../../services/sportEventService";
import sportEventTypeService from "../../../services/sportEventTypeService";
import teamplayerService, { type PlayerResponse } from "../../../services/teamplayerService";
import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Returns true if the player was injured at (or before) eventDay.
 *  If no injuryStartDate is recorded, we treat it as a safe fallback (assume injured). */
function wasInjuredOnDate(injuryStartDate: string | null | undefined, eventDay: string): boolean {
  if (!injuryStartDate) return true;
  return injuryStartDate.slice(0, 10) <= eventDay;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DesconvocatoriasGridReturn = {
  matchColumns: MatchColumn[];
  enrichedGrid: Map<string, Map<string, GridCell>>;
  isLoading: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDesconvocatoriasGrid(teamId: string): DesconvocatoriasGridReturn {
  const [matchColumns, setMatchColumns] = useState<MatchColumn[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [gridData, setGridData] = useState<Map<string, Map<string, GridCell>>>(new Map());
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [statuses, setStatuses] = useState<ConvocationStatus[]>([]);
  const [excuseTypes, setExcuseTypes] = useState<ExcuseType[]>([]);

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

  // ── Load past matches + convocations ─────────────────────────────────────
  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    setLoadingEvents(true);

    (async () => {
      try {
        let matchTypeIds = new Set<number>();
        try {
          const types = await sportEventTypeService.getSportEventTypes();
          types.forEach((t) => {
            const n = (t.name ?? "").toLowerCase();
            if (n.includes("partido") || n.includes("match") || n === "liga") {
              matchTypeIds.add(t.id);
            }
          });
        } catch {
          /* fall back to name-based check */
        }

        const today = new Date().toISOString().split("T")[0];
        const resp = await sportEventService.getSportEvents(teamId, 1, 200, undefined, today, true);

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
                statusName: "",
                excuseName: null,
              });
            }
          }
          newGrid.set(col.eventId, playerMap);
        });

        // ── Auto-register injured players for each past match ──────────────
        const [allPlayers, allStatuses] = await Promise.all([
          teamplayerService.getPlayersByTeam(teamId),
          convocationStatusService.getConvocationStatuses(),
        ]);
        const deconvokeId = allStatuses.find((s) => s.name === "Deconvoke")?.id;
        const injuryExcuseId = 1; // ExcuseType id=1 = "Lesión"

        if (deconvokeId) {
          for (const col of cols) {
            const eventDay = col.date ? col.date.slice(0, 10) : "";
            if (!eventDay) continue;
            const playerMap = newGrid.get(col.eventId) ?? new Map<string, GridCell>();

            const injuredPlayers = allPlayers.filter(
              (p) => p.isInjured && p.id && wasInjuredOnDate(p.injuryStartDate, eventDay)
            );

            for (const p of injuredPlayers) {
              const existing = playerMap.get(p.id);

              // Already registered as Deconvoke+Lesión → nothing to do
              if (existing?.statusId === deconvokeId && existing?.excuseTypeId === injuryExcuseId) {
                continue;
              }

              try {
                if (!existing) {
                  // Player has no convocation record for this event → add it
                  await convocationService.addConvocation(col.eventId, p.id);
                }

                // Reload to get the convocationId, then set Deconvoke+Lesión
                const reloaded = await convocationService.getConvocations(col.eventId);
                const conv = reloaded.find((c) => c.player?.id === p.id);
                if (conv) {
                  await convocationService.updateConvocationStatus(
                    col.eventId,
                    conv.id,
                    deconvokeId,
                    injuryExcuseId
                  );
                  playerMap.set(p.id, {
                    statusId: deconvokeId,
                    excuseTypeId: injuryExcuseId,
                    statusName: "",
                    excuseName: null,
                  });
                }
              } catch {
                // non-blocking
              }
            }
            newGrid.set(col.eventId, playerMap);
          }
        }
        // ──────────────────────────────────────────────────────────────────

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

    return () => {
      mounted = false;
    };
  }, [teamId]);

  // ── Enrich cell labels once catalogs arrive ──────────────────────────────
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

  const enrichedGrid = useMemo<Map<string, Map<string, GridCell>>>(() => {
    if (statusMap.size === 0) return gridData;
    const out = new Map<string, Map<string, GridCell>>();
    gridData.forEach((playerMap, eventId) => {
      const enriched = new Map<string, GridCell>();
      playerMap.forEach((cell, playerId) => {
        enriched.set(playerId, {
          ...cell,
          statusName:
            cell.statusId != null
              ? (statusMap.get(cell.statusId) ?? String(cell.statusId))
              : "",
          excuseName:
            cell.excuseTypeId != null ? (excuseMap.get(cell.excuseTypeId) ?? null) : null,
        });
      });
      out.set(eventId, enriched);
    });
    return out;
  }, [gridData, statusMap, excuseMap]);

  return {
    matchColumns,
    enrichedGrid,
    isLoading: loadingEvents || loadingGrid,
  };
}
