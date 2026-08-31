import { useCallback, useEffect, useRef, useState } from "react";
import { calendarService, settingsService } from "../../../../federation/services/Federation";
import sportEventService from "../../../services/sportEventService";
import { normalizeFromSportEvent, normalizeRawMatch } from "../helpers/convocationUtils";
import type { NormalizedMatch } from "../types";

export function useConvocations(teamId?: string) {
  const [matches, setMatches] = useState<NormalizedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [federationTeamId, setFederationTeamId] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncSnackbar, setSyncSnackbar] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load federation settings → get the federation team ID
  useEffect(() => {
    let mounted = true;
    setSettingsLoading(true);
    (async () => {
      try {
        const settings = await settingsService.getSettings();
        if (!mounted) return;
        const primary = settings.find((s) => s.isPrimary) ?? settings[0] ?? null;
        setFederationTeamId(primary?.teamId ?? null);
      } catch {
        if (mounted) setFederationTeamId(null);
      } finally {
        if (mounted) setSettingsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const loadCoachEvents = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      setMatches([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pageSize = 200;
      let pageNumber = 1;
      const allItems: Array<any> = [];
      const seenEventIds = new Set<string>();
      const MAX_PAGES = 12;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await sportEventService.getSportEvents(teamId, pageNumber, pageSize);
        const pageItems = Array.isArray(result.items) ? result.items : [];
        let addedInPage = 0;
        for (const item of pageItems) {
          const id = item?.id != null ? String(item.id) : "";
          const syntheticId = id || JSON.stringify(item);
          if (seenEventIds.has(syntheticId)) continue;
          seenEventIds.add(syntheticId);
          allItems.push(item);
          addedInPage++;
        }

        const totalPages = Number(result.totalPages);
        const reachedLastPageByMeta = Number.isFinite(totalPages) && totalPages > 0 && pageNumber >= totalPages;
        const reachedLastPageByCount = pageItems.length < pageSize;
        const noProgress = addedInPage === 0;
        if (reachedLastPageByMeta || reachedLastPageByCount || noProgress) break;

        pageNumber++;
        if (pageNumber > MAX_PAGES) break;
      }
      if (!mountedRef.current) return;
      const matchEvents = allItems.filter(
        (ev) => (ev.eventTypeId ?? 0) === 1 || (ev.eventType ?? "").toLowerCase().includes("partido")
      );
      setMatches(matchEvents.map(normalizeFromSportEvent));
    } catch (e) {
      if (mountedRef.current) setError("No se pudo cargar el calendario de partidos.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (settingsLoading) return;
    loadCoachEvents();
  }, [teamId, settingsLoading, loadCoachEvents]);

  useEffect(() => {
    if (!loading) return;
    const timeoutId = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading(false);
      setError((prev) => prev ?? "La carga está tardando demasiado. Intenta recargar la página.");
    }, 15000);
    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  const handleSyncCalendar = useCallback(async () => {
    if (!federationTeamId || !teamId || syncing) return;
    setSyncing(true);
    try {
      const raw = await calendarService.getTeamMatches(federationTeamId) as Array<{ date: string | null; match: Record<string, unknown> }>;

      let myTeamShieldUrl: string | null = null;
      for (const item of raw) {
        const normalized = normalizeRawMatch(item, federationTeamId);
        const shield = normalized.isHomeTeam ? normalized.localTeamShield : normalized.visitorTeamShield;
        if (shield) { myTeamShieldUrl = shield; break; }
      }

      const syncItems = raw
        .reduce<any[]>((acc, item) => {
          const normalized = normalizeRawMatch(item, federationTeamId);
          if (!normalized.date) return acc;
          const rivalName = normalized.isHomeTeam
            ? normalized.visitorTeamName
            : normalized.localTeamName;
          const rivalShieldUrl = normalized.isHomeTeam
            ? normalized.visitorTeamShield
            : normalized.localTeamShield;
          acc.push({
            rivalName: rivalName || "Rival desconocido",
            rivalShieldUrl: rivalShieldUrl || null,
            matchDate: normalized.date,
            matchTime: normalized.time || null,
            field: normalized.field || null,
            isHomeMatch: normalized.isHomeTeam,
            codActa: normalized.codacta ?? null,
            localGoals: normalized.localGoals,
            visitorGoals: normalized.visitorGoals,
          });
          return acc;
        }, []);

      if (syncItems.length === 0) {
        setSyncSnackbar("No se encontraron partidos en el calendario de federación.");
        return;
      }

      const result = await sportEventService.syncCalendarFromFederation({ teamId, matches: syncItems, myTeamShieldUrl });
      const failedMsg = result.failed > 0 ? `, ${result.failed} con error` : "";
      setSyncSnackbar(`Calendario sincronizado: ${result.created} creados, ${result.updated} actualizados${failedMsg}.`);

      // Reload coach events
      await loadCoachEvents();
    } catch {
      setSyncSnackbar("Error al sincronizar el calendario. Intenta de nuevo.");
    } finally {
      setSyncing(false);
    }
  }, [federationTeamId, teamId, syncing, loadCoachEvents]);

  return {
    matches,
    loading,
    error,
    federationTeamId,
    settingsLoading,
    syncing,
    syncSnackbar,
    setSyncSnackbar,
    loadCoachEvents,
    handleSyncCalendar,
  } as const;
}

export default useConvocations;
