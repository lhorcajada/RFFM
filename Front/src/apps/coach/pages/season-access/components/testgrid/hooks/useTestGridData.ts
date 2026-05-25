import { useEffect, useMemo, useState } from 'react';
import type { Player, Demarcation, Status } from '../types';
import { SAMPLE_PLAYERS } from '../helper/helpers';
import { exportTestGridToExcel } from '../exportToExcel';

export interface UseTestGridDataParams {
  initialPlayers?: Player[];
  demarcations?: Demarcation[];
  onChange?: (players: Player[]) => void;
  onPlayerChange?: (player: Player) => void;
  onPlayerRemove?: (player: Player) => Promise<void> | void;
}

export default function useTestGridData({
  initialPlayers = SAMPLE_PLAYERS,
  demarcations = [],
  onChange,
  onPlayerChange,
  onPlayerRemove,
}: UseTestGridDataParams) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [exporting, setExporting] = useState(false);
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | ''>('');
  const [filterDemarcation, setFilterDemarcation] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<{ key: keyof Player | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });

  useEffect(() => {
    setPlayers((prev) => {
      const prevServerIds = new Set(prev.filter((p) => p.trialPlayerId).map((p) => String(p.trialPlayerId)));
      const newServerIds = new Set(initialPlayers.filter((p) => p.trialPlayerId).map((p) => String(p.trialPlayerId)));

      const setsEqual = prevServerIds.size === newServerIds.size && [...prevServerIds].every((id) => newServerIds.has(id));

      if (setsEqual) {
        const serverMap = new Map<string, Player>(initialPlayers.filter((p) => p.trialPlayerId).map((p) => [String(p.trialPlayerId), p]));
        return prev.map((lp) => {
          if (!lp.trialPlayerId) return lp;
          const sp = serverMap.get(String(lp.trialPlayerId));
          if (!sp) return lp;
          let normalizedStatus = lp.status;
          try {
            const s = (sp.status ?? '').toString().trim().toLowerCase();
            if (s === 'descartado' || s === 'poco' || s === 'interesado' || s === 'solicitado' || s === 'seleccionado') normalizedStatus = s as Player['status'];
          } catch {}
          return {
            ...lp,
            status: normalizedStatus,
            rating: (sp.rating ?? lp.rating) as number,
            idealDemarcationId: sp.idealDemarcationId ?? lp.idealDemarcationId,
            possibleDemarcationIds: sp.possibleDemarcationIds ?? lp.possibleDemarcationIds,
            totalGoals: (sp.totalGoals ?? lp.totalGoals) as any,
          };
        });
      }

      const merged: Player[] = [];
      const prevUnsaved = prev.filter((p) => !p.trialPlayerId);
      const unsavedByCode = new Map<string, Player>();
      const unsavedByName = new Map<string, Player>();
      for (const lp of prevUnsaved) {
        if (lp.federationPlayerCode) unsavedByCode.set(String(lp.federationPlayerCode).trim(), lp);
        const nk = String(lp.name ?? '').trim().toLowerCase();
        if (nk) unsavedByName.set(nk, lp);
      }

      const prevMaxId = prev.length ? Math.max(...prev.map((p) => p.id)) : 0;
      let nextId = prevMaxId > 0 ? prevMaxId + 1 : 1;

      for (const sp of initialPlayers) {
        let matchedLocal: Player | undefined;
        if (sp.federationPlayerCode && unsavedByCode.has(String(sp.federationPlayerCode).trim())) {
          matchedLocal = unsavedByCode.get(String(sp.federationPlayerCode).trim());
          unsavedByCode.delete(String(sp.federationPlayerCode).trim());
        } else {
          const key = String(sp.name ?? '').trim().toLowerCase();
          if (key && unsavedByName.has(key)) {
            matchedLocal = unsavedByName.get(key);
            unsavedByName.delete(key);
          }
        }

        if (matchedLocal) {
          merged.push({ ...sp, id: matchedLocal.id });
        } else {
          merged.push({ ...sp, id: nextId++ });
        }
      }

      for (const lp of [...unsavedByCode.values(), ...unsavedByName.values()]) {
        merged.push({ ...lp, id: nextId++ });
      }

      return merged;
    });
  }, [initialPlayers]);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      if (filterTeam && !(p.teamName ?? '').toLowerCase().includes(filterTeam.toLowerCase())) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterDemarcation !== '' && p.idealDemarcationId !== filterDemarcation) return false;
      return true;
    });
  }, [players, filterTeam, filterStatus, filterDemarcation]);

  const sorted = useMemo(() => {
    if (!sortBy.key) return filtered;
    const sortedCopy = [...filtered].sort((a, b) => {
      const av = a[sortBy.key as keyof Player];
      const bv = b[sortBy.key as keyof Player];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortBy.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortBy.dir === 'asc' ? av - bv : bv - av;
      }
      return 0;
    });
    return sortedCopy;
  }, [filtered, sortBy]);

  const statusCounts = useMemo(() => {
    return filtered.reduce<Record<Status, number>>(
      (acc, player) => {
        acc[player.status] += 1;
        return acc;
      },
      { descartado: 0, poco: 0, interesado: 0, solicitado: 0, seleccionado: 0 },
    );
  }, [filtered]);

  const [openStatusPopup, setOpenStatusPopup] = useState<Status | null>(null);

  const playersInOpenStatus = useMemo(() => (openStatusPopup ? filtered.filter((p) => p.status === openStatusPopup) : [] as Player[]), [filtered, openStatusPopup]);

  const demarcationCounts = useMemo(() => {
    if (!openStatusPopup) return [] as Array<{ demId: number; code: string; name: string; ideal: number; possible: number }>;
    return demarcations
      .map((d) => ({
        demId: d.id,
        code: d.code,
        name: d.name,
        ideal: playersInOpenStatus.filter((p) => p.idealDemarcationId === d.id).length,
        possible: playersInOpenStatus.filter((p) => (p.possibleDemarcationIds ?? []).includes(d.id) && p.idealDemarcationId !== d.id).length,
      }))
      .filter((x) => x.ideal > 0 || x.possible > 0)
      .sort((a, b) => b.ideal + b.possible - (a.ideal + a.possible));
  }, [demarcations, playersInOpenStatus, openStatusPopup]);

  const teamsByStatus = useMemo(() => {
    const init: Record<Status, Record<string, number>> = { descartado: {}, poco: {}, interesado: {}, solicitado: {}, seleccionado: {} };
    return filtered.reduce<Record<Status, Record<string, number>>>((acc, player) => {
      const team = (player.teamName && player.teamName.trim()) || 'Sin equipo';
      const map = acc[player.status] ?? {};
      map[team] = (map[team] || 0) + 1;
      acc[player.status] = map;
      return acc;
    }, init);
  }, [filtered]);

  const toggleSort = (key: keyof Player) => {
    setSortBy((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  };

  const updatePlayer = <K extends keyof Player>(id: number, field: K, value: Player[K]) => {
    setPlayers((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, [field]: value } as Player;
        if (!next.trialPlayerId && !next.federationPlayerCode) {
          next.federationPlayerCode = `local-${id}-${Date.now()}`;
        }
        return next;
      });
      if (onChange) onChange(updated);
      const changed = updated.find((p) => p.id === id);
      if (onPlayerChange && changed) onPlayerChange(changed);
      return updated;
    });
  };

  const notifyPlayerChange = (updated: Player[], id: number) => {
    if (onChange) onChange(updated);
    const changed = updated.find((p) => p.id === id);
    if (onPlayerChange && changed) onPlayerChange(changed);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportTestGridToExcel(sorted, demarcations);
    } finally {
      setExporting(false);
    }
  };

  const addPlayer = () => {
    const newId = players.length > 0 ? Math.max(...players.map((p) => p.id)) + 1 : 1;
    setPlayers((prev) => [
      { id: newId, name: '', birthYear: new Date().getFullYear() - 15, teamName: '', teamCode: undefined, federationPlayerCode: `local-${newId}-${Date.now()}`, category: '', status: 'interesado', rating: 0, possibleDemarcationIds: [] },
      ...prev,
    ]);
  };

  const removePlayer = async (id: number) => {
    const found = players.find((p) => p.id === id);
    if (!found) return;
    try {
      if (onPlayerRemove) {
        await onPlayerRemove(found);
      }
    } catch {
      // swallow remove errors; still remove locally optimistically
    }
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const togglePossible = (playerId: number, demarcationId: number) => {
    setPlayers((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== playerId) return p;
        const ids = p.possibleDemarcationIds ?? [];
        const next = ids.includes(demarcationId) ? ids.filter((x) => x !== demarcationId) : [...ids, demarcationId];
        return { ...p, possibleDemarcationIds: next };
      });
      notifyPlayerChange(updated, playerId);
      return updated;
    });
  };

  const hasFilters = filterTeam !== '' || filterStatus !== '' || filterDemarcation !== '';

  return {
    players,
    filtered,
    sorted,
    demarcations,
    filterTeam,
    setFilterTeam,
    filterStatus,
    setFilterStatus,
    filterDemarcation,
    setFilterDemarcation,
    sortBy,
    toggleSort,
    statusCounts,
    teamsByStatus,
    openStatusPopup,
    setOpenStatusPopup,
    playersInOpenStatus,
    demarcationCounts,
    addPlayer,
    removePlayer,
    updatePlayer,
    togglePossible,
    exporting,
    handleExport,
    hasFilters,
  };
}
