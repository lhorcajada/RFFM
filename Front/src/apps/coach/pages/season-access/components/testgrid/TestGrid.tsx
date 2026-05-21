import React, { useEffect, useMemo, useState } from 'react';
import styles from './TestGrid.module.css';
import { exportTestGridToExcel } from './exportToExcel';

type Status = 'descartado' | 'poco' | 'interesado' | 'seleccionado';

export interface Demarcation {
  id: number;
  name: string;
  code: string;
}

export interface Player {
  id: number;
  trialPlayerId?: string;
  federationPlayerCode?: string;
  name: string;
  birthYear: number;
  teamName?: string;
  category?: string;
  status: Status;
  rating: number;
  idealDemarcationId?: number | null;
  possibleDemarcationIds?: number[];
  totalGoals?: number | null;
}

interface TestGridProps {
  initialPlayers?: Player[];
  demarcations?: Demarcation[];
  onChange?: (players: Player[]) => void;
  onPlayerChange?: (player: Player) => void;
}

// Normalise: trim, uppercase, strip diacritics, collapse spaces
const normCat = (s: string) =>
  s.trim().toUpperCase()
   .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .replace(/\s+/g, ' ');

// [background, color] per exact normalised league name
const CAT_COLORS: Record<string, [string, string]> = {
  // ── Infantiles (greens, top→bottom saturation) ──────────────────────────────
  'SUPERLIGA INFANTIL':                              ['rgba(0,200,83,0.24)',    '#00c853'],
  'DIVISION DE HONOR INFANTIL':                      ['rgba(0,230,118,0.22)',   '#00e676'],
  'PRIMERA DIVISION AUTONOMICA INFANTIL':            ['rgba(105,240,174,0.18)', '#69f0ae'],
  'PREFERENTE INFANTIL':                             ['rgba(102,187,106,0.18)', '#66bb6a'],
  'PRIMERA INFANTIL':                                ['rgba(129,199,132,0.16)', '#81c784'],
  'SEGUNDA INFANTIL':                                ['rgba(165,214,167,0.14)', '#a5d6a7'],
  // ── Cadetes (cyans) ──────────────────────────────────────────────────────────
  'SUPERLIGA CADETE':                                ['rgba(0,131,143,0.26)',   '#00838f'],
  'DIVISION DE HONOR CADETE':                        ['rgba(0,188,212,0.24)',   '#00bcd4'],
  'PRIMERA DIVISION AUTONOMICA CADETE':              ['rgba(0,229,255,0.20)',   '#00e5ff'],
  'PREFERENTE CADETE':                               ['rgba(79,195,247,0.18)',  '#4fc3f7'],
  'PRIMERA CADETE':                                  ['rgba(129,212,250,0.16)', '#81d4fa'],
  'SEGUNDA CADETE':                                  ['rgba(144,202,249,0.14)', '#90caf9'],
  // ── Juveniles (blues) ────────────────────────────────────────────────────────
  'NACIONAL JUVENIL':                                ['rgba(25,118,210,0.28)',  '#2196f3'],
  'FINAL CAMPEON PRIMERA DIVISION AUTONOMICA JUVENIL': ['rgba(33,150,243,0.24)', '#42a5f5'],
  'PRIMERA DIVISION AUTONOMICA JUVENIL':             ['rgba(77,157,224,0.22)',  '#4d9de0'],
  'PREFERENTE JUVENIL':                              ['rgba(100,181,246,0.20)', '#64b5f6'],
  'PRIMERA JUVENIL':                                 ['rgba(144,202,249,0.18)', '#90caf9'],
  'SEGUNDA JUVENIL':                                 ['rgba(187,222,251,0.14)', '#bbdefb'],
  // ── Alevines (ambers) ────────────────────────────────────────────────────────
  'SUPERLIGA ALEVIN':                                ['rgba(255,143,0,0.26)',   '#ff8f00'],
  'DIVISION DE HONOR ALEVIN':                        ['rgba(255,160,0,0.24)',   '#ffa000'],
  'PRIMERA DIVISION AUTONOMICA ALEVIN':              ['rgba(255,179,0,0.22)',   '#ffb300'],
  'PREFERENTE ALEVIN':                               ['rgba(255,202,40,0.20)',  '#ffca28'],
  'PRIMERA ALEVIN':                                  ['rgba(255,213,79,0.18)',  '#ffd54f'],
  // ── Femenino absoluto (pinks) ─────────────────────────────────────────────────
  'PRIMERA DIVISION AUTONOMICA FEMENINO':            ['rgba(233,30,99,0.24)',   '#e91e63'],
  'PREFERENTE FUTBOL FEMENINO':                      ['rgba(236,64,122,0.22)',  '#ec407a'],
  'PRIMERA FUTBOL FEMENINO':                         ['rgba(240,98,146,0.20)',  '#f06292'],
  // ── Femenino Juvenil (malvas) ────────────────────────────────────────────────
  'PRIMERA DIVISION AUTONOMICA FEMENINO JUVENIL':    ['rgba(186,73,180,0.24)',  '#ba49b4'],
  'PREFERENTE FEMENINO JUVENIL':                     ['rgba(206,147,216,0.22)', '#ce93d8'],
  'PRIMERA FEMENINO JUVENIL':                        ['rgba(225,190,231,0.18)', '#e1bee7'],
  // ── Femenino Cadete (rosas oscuras) ──────────────────────────────────────────
  'PRIMERA DIVISION AUTONOMICA FEMENINO CADETE':     ['rgba(216,27,96,0.26)',   '#d81b60'],
  'PREFERENTE FEMENINO CADETE':                      ['rgba(233,30,99,0.22)',   '#e91e63'],
  'PRIMERA FEMENINO CADETE':                         ['rgba(240,98,146,0.18)',  '#f06292'],
  // ── Nacional / Aficionados (rojos → naranja) ─────────────────────────────────
  'TERCERA FEDERACION RFEF':                         ['rgba(229,57,53,0.28)',   '#e53935'],
  'PLAY OFF TERCERA FEDERACION':                     ['rgba(239,83,80,0.26)',   '#ef5350'],
  'COPA RFEF FASE AUTONOMICA':                       ['rgba(239,108,0,0.24)',   '#ef6c00'],
  'FINAL COPA RFEF FASE AUTONOMICA':                 ['rgba(245,124,0,0.22)',   '#f57c00'],
  'COPA RFFM PRIMERA DIVISION AUTONOMICA AFICIONADOS': ['rgba(255,152,0,0.22)', '#ff9800'],
  'FASE FINAL COPA DE AFICIONADOS RFFM TEMP 2024/25': ['rgba(255,152,0,0.20)', '#ff9800'],
  'PREFERENTE AFICIONADO':                           ['rgba(255,152,0,0.22)',   '#ff9800'],
  'SEGUNDA AFICIONADO':                              ['rgba(255,183,77,0.20)',  '#ffb74d'],
  // ── Benjamines (naranja) ─────────────────────────────────────────────────────
  'PRIMERA DIVISION AUTONOMICA BENJAMIN':            ['rgba(255,112,67,0.24)',  '#ff7043'],
  'PREFERENTE BENJAMIN':                             ['rgba(255,138,101,0.22)', '#ff8a65'],
  'PRIMERA BENJAMIN':                                ['rgba(255,171,145,0.20)', '#ffab91'],
  'SEGUNDA BENJAMIN':                                ['rgba(255,204,188,0.18)', '#ffccbc'],
  // ── Prebenjamines (rosas) ────────────────────────────────────────────────────
  'PRIMERA DIVISION AUTONOMICA PREBENJAMIN':         ['rgba(240,98,146,0.24)',  '#f06292'],
  'PREFERENTE PREBENJAMIN':                          ['rgba(244,143,177,0.22)', '#f48fb1'],
  'PRIMERA PREBENJAMIN':                             ['rgba(248,187,208,0.20)', '#f8bbd0'],
  // ── Debutantes (purpuras) ────────────────────────────────────────────────────
  'PRIMERA DIVISION AUTONOMICA DEBUTANTES':          ['rgba(171,71,188,0.24)',  '#ab47bc'],
  'PREFERENTE DEBUTANTES':                           ['rgba(186,104,200,0.22)', '#ba68c8'],
  'PRIMERA DEBUTANTES':                              ['rgba(206,147,216,0.20)', '#ce93d8'],
  // ── Miscelánea ────────────────────────────────────────────────────────────────
  'VETERANOS MASCULINO F11':                         ['rgba(120,144,156,0.20)', '#78909c'],
  'CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-14': ['rgba(77,157,224,0.24)', '#4d9de0'],
  'CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-16': ['rgba(100,181,246,0.22)', '#64b5f6'],
  'CAMPEONATO UNIVERSITARIO FEMENINO':               ['rgba(240,98,146,0.18)',  '#f06292'],
  'CAMPEONATO UNIVERSITARIO MASCULINO':              ['rgba(129,199,132,0.18)', '#81c784'],
  'CAMPEONATO UNIVERSITARIO MASCULINO 2A FASE F11':  ['rgba(165,214,167,0.16)', '#a5d6a7'],
};

const getCategoryStyle = (category?: string | null): React.CSSProperties => {
  if (!category) return {};
  const match = CAT_COLORS[normCat(category)];
  if (match) return { background: match[0], color: match[1] };
  return {};
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'descartado', label: 'Descartado' },
  { value: 'poco', label: 'Poco interés' },
  { value: 'interesado', label: 'Interesado' },
  { value: 'seleccionado', label: 'Seleccionado' },
];

const STATUS_BADGE_LABELS: Record<Status, string> = {
  descartado: 'Descartados',
  poco: 'Poco interés',
  interesado: 'Interesados',
  seleccionado: 'Seleccionados',
};

const SAMPLE_PLAYERS: Player[] = [
  { id: 1, name: 'Juan Pérez', birthYear: 1998, teamName: 'CD Ejemplo A', category: 'Juvenil A', status: 'interesado', rating: 78, totalGoals: 12 },
  { id: 2, name: 'María López', birthYear: 2000, teamName: 'CD Ejemplo B', category: 'Cadete A', status: 'poco', rating: 62, totalGoals: 5 },
  { id: 3, name: 'Carlos García', birthYear: 1995, teamName: 'CD Ejemplo A', category: 'Juvenil A', status: 'seleccionado', rating: 90, totalGoals: 23 },
  { id: 4, name: 'Ana Torres', birthYear: 2003, teamName: 'CD Ejemplo C', category: 'Infantil A', status: 'descartado', rating: 45, totalGoals: 0 },
];

const TestGrid: React.FC<TestGridProps> = ({ initialPlayers = SAMPLE_PLAYERS, demarcations = [], onChange, onPlayerChange }) => {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [exporting, setExporting] = useState(false);
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | ''>('');
  const [filterDemarcation, setFilterDemarcation] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<{ key: keyof Player | null; dir: 'asc' | 'desc' }>({
    key: null,
    dir: 'asc',
  });

  useEffect(() => {
    setPlayers(initialPlayers);
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
      { descartado: 0, poco: 0, interesado: 0, seleccionado: 0 },
    );
  }, [filtered]);

  const [openStatusPopup, setOpenStatusPopup] = useState<Status | null>(null);

  const playersInOpenStatus = useMemo(() => {
    return openStatusPopup ? filtered.filter((p) => p.status === openStatusPopup) : [] as Player[];
  }, [filtered, openStatusPopup]);

  const demarcationCounts = useMemo(() => {
    if (!openStatusPopup) return [] as Array<{ demId: number; code: string; name: string; ideal: number; possible: number }>;
    return demarcations
      .map((d) => ({
        demId: d.id,
        code: d.code,
        name: d.name,
        ideal: playersInOpenStatus.filter((p) => p.idealDemarcationId === d.id).length,
        // Exclude players whose ideal demarcation is this one from the 'possible' count
        possible: playersInOpenStatus.filter(
          (p) => (p.possibleDemarcationIds ?? []).includes(d.id) && p.idealDemarcationId !== d.id,
        ).length,
      }))
      .filter((x) => x.ideal > 0 || x.possible > 0)
      .sort((a, b) => b.ideal + b.possible - (a.ideal + a.possible));
  }, [demarcations, playersInOpenStatus, openStatusPopup]);

  const teamsByStatus = useMemo(() => {
    const init: Record<Status, Record<string, number>> = {
      descartado: {},
      poco: {},
      interesado: {},
      seleccionado: {},
    };
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
      const updated = prev.map((p) => (p.id === id ? { ...p, [field]: value } : p));
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

  const sortIcon = (key: keyof Player) =>
    sortBy.key === key ? (
      <span className={styles.sortIcon}>{sortBy.dir === 'asc' ? '▲' : '▼'}</span>
    ) : (
      <span className={styles.sortIconInactive}>⇅</span>
    );

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
      { id: newId, name: '', birthYear: new Date().getFullYear() - 15, teamName: '', category: '', status: 'interesado', rating: 0 },
      ...prev,
    ]);
  };

  const removePlayer = (id: number) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const togglePossible = (playerId: number, demarcationId: number) => {
    setPlayers((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== playerId) return p;
        const ids = p.possibleDemarcationIds ?? [];
        const next = ids.includes(demarcationId)
          ? ids.filter((x) => x !== demarcationId)
          : [...ids, demarcationId];
        return { ...p, possibleDemarcationIds: next };
      });
      notifyPlayerChange(updated, playerId);
      return updated;
    });
  };

  const hasFilters = filterTeam !== '' || filterStatus !== '' || filterDemarcation !== '';

  return (
    <div className={styles.container}>
      <div className={styles.filterBar}>
        <input
          className={styles.filterInput}
          placeholder="Filtrar por equipo…"
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as Status | '')}
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterDemarcation === '' ? '' : String(filterDemarcation)}
          onChange={(e) => setFilterDemarcation(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">Todas las dem. ideales</option>
          {demarcations.map((d) => (
            <option key={d.id} value={String(d.id)}>{d.code} – {d.name}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            className={styles.clearFiltersBtn}
            onClick={() => { setFilterTeam(''); setFilterStatus(''); setFilterDemarcation(''); }}
          >
            ✕ Limpiar filtros
          </button>
        )}
        <span className={styles.filterCount} aria-live="polite">
          <span className={styles.filterCountBadge} aria-hidden>{filtered.length}</span>
          <span className={styles.filterCountTotal}>/ {players.length}</span>
        </span>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.statusSummary} aria-label="Resumen por estado">
          {STATUS_OPTIONS.map((opt) => {
            const teamsMap = teamsByStatus[opt.value] || {};
            const teamsArray = Object.entries(teamsMap).sort((a, b) => b[1] - a[1]);
            const displayed = teamsArray.slice(0, 10);
            const more = teamsArray.length - displayed.length;
            const full = teamsArray.map(([t, c]) => `${t}: ${c}`).join('\n');
            return (
              <div
                key={opt.value}
                className={`${styles.statusTag} ${styles[`statusTag-${opt.value}`]}`}
                title={full}
                role="button"
                tabIndex={0}
                onClick={() => setOpenStatusPopup(opt.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenStatusPopup(opt.value); }}
                aria-label={`${STATUS_BADGE_LABELS[opt.value]}: ${statusCounts[opt.value]}`}>
                <div className={styles.statusTagTop}>
                  <span className={styles.statusTagLabel}>{STATUS_BADGE_LABELS[opt.value]}</span>
                  <span className={styles.statusTagCount}>{statusCounts[opt.value]}</span>
                </div>
                <div className={styles.statusTagTeams} aria-hidden>
                  {displayed.map(([team, count]) => (
                    <div key={team} className={styles.statusTeamRow}>
                      <span className={styles.statusTeamName}>{team}</span>
                      <span className={styles.statusTeamCount}>{count}</span>
                    </div>
                  ))}
                  {more > 0 && <div className={styles.statusTeamMore}>+{more} más</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.addRowBtn} onClick={addPlayer}>
            + Añadir jugador
          </button>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={exporting || players.length === 0}
            title="Descargar Excel"
          >
            {exporting ? 'Exportando…' : '⬇ Excel'}
          </button>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} onClick={() => toggleSort('name')}>
                <div className={styles.thHeader}>Nombre {sortIcon('name')}</div>
              </th>
              <th className={styles.th} onClick={() => toggleSort('birthYear')}>
                <div className={styles.thHeader}>Año {sortIcon('birthYear')}</div>
              </th>
              <th className={styles.th} onClick={() => toggleSort('teamName' as keyof Player)}>
                <div className={styles.thHeader}>Equipo {sortIcon('teamName' as keyof Player)}</div>
              </th>
              <th className={styles.th} onClick={() => toggleSort('category' as keyof Player)}>
                <div className={styles.thHeader}>Categoría {sortIcon('category' as keyof Player)}</div>
              </th>
              <th className={styles.th} onClick={() => toggleSort('status')}>
                <div className={styles.thHeader}>Estado {sortIcon('status')}</div>
              </th>
              <th className={styles.th} onClick={() => toggleSort('idealDemarcationId' as keyof Player)}>
                <div className={styles.thHeader}>Dem. ideal {sortIcon('idealDemarcationId' as keyof Player)}</div>
              </th>
              <th className={styles.th}>
                <div className={styles.thHeader}>Dem. posibles</div>
              </th>
              <th className={styles.th} onClick={() => toggleSort('totalGoals' as keyof Player)}>
                <div className={styles.thHeader}>Goles {sortIcon('totalGoals' as keyof Player)}</div>
              </th>
              <th className={styles.th} onClick={() => toggleSort('rating')}>
                <div className={styles.thHeader}>Valoración {sortIcon('rating')}</div>
              </th>
              <th className={styles.thAction} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className={styles.tr}>
                <td className={styles.td}>
                  <input
                    className={styles.input}
                    value={p.name}
                    onChange={(e) => updatePlayer(p.id, 'name', e.target.value)}
                  />
                </td>
                <td className={styles.tdNarrow}>
                  <input
                    className={styles.input}
                    type="number"
                    value={p.birthYear}
                    onChange={(e) => updatePlayer(p.id, 'birthYear', Number(e.target.value || 0))}
                    min={1900}
                    max={new Date().getFullYear()}
                  />
                </td>
                <td className={styles.td}>
                  <input
                    className={styles.input}
                    value={p.teamName ?? ''}
                    placeholder="Equipo"
                    onChange={(e) => updatePlayer(p.id, 'teamName' as keyof Player, e.target.value as any)}
                  />
                </td>
                <td className={styles.td}>
                  <input
                    className={styles.input}
                    value={p.category ?? ''}
                    placeholder="Categoría"
                    onChange={(e) => updatePlayer(p.id, 'category' as keyof Player, e.target.value as any)}
                  />
                </td>
                <td className={styles.tdNarrow}>
                  <select
                    className={`${styles.select} ${styles[`status-${p.status}`]}`}
                    value={p.status}
                    onChange={(e) => updatePlayer(p.id, 'status', e.target.value as Status)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={styles.tdNarrow}>
                  <select
                    className={styles.select}
                    value={p.idealDemarcationId != null ? String(p.idealDemarcationId) : ''}
                    onChange={(e) =>
                      updatePlayer(
                        p.id,
                        'idealDemarcationId' as keyof Player,
                        e.target.value === '' ? (null as any) : (Number(e.target.value) as any),
                      )
                    }
                  >
                    <option value="">—</option>
                    {demarcations.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={styles.td}>
                  <div className={styles.chipRow}>
                    {demarcations.map((d) => {
                      const active = (p.possibleDemarcationIds ?? []).includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`${styles.demChip} ${active ? styles.demChipActive : ''}`}
                          onClick={() => togglePossible(p.id, d.id)}
                        >
                          {d.code}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className={styles.tdNarrow}>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={p.totalGoals != null ? String(p.totalGoals) : ''}
                    placeholder="-"
                    onChange={(e) =>
                      updatePlayer(
                        p.id,
                        'totalGoals' as keyof Player,
                        e.target.value === '' ? (null as any) : (Number(e.target.value) as any),
                      )
                    }
                  />
                </td>
                <td className={styles.tdNarrow}>
                  <input
                    className={styles.input}
                    type="number"
                    value={p.rating}
                    onChange={(e) => updatePlayer(p.id, 'rating', Number(e.target.value || 0))}
                    min={0}
                    max={100}
                  />
                </td>
                <td className={styles.tdAction}>
                  <button
                    type="button"
                    className={styles.deleteRowBtn}
                    onClick={() => removePlayer(p.id)}
                    title="Eliminar jugador"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openStatusPopup && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" onClick={() => setOpenStatusPopup(null)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Demarcaciones — {STATUS_BADGE_LABELS[openStatusPopup]}</h3>
              <button type="button" className={styles.modalCloseBtn} onClick={() => setOpenStatusPopup(null)} aria-label="Cerrar">✕</button>
            </div>
            <div className={styles.modalBody}>
              {demarcationCounts.length === 0 ? (
                <div className={styles.modalEmpty}>No hay jugadores en este estado.</div>
              ) : (
                <table className={styles.modalTable}>
                  <thead>
                    <tr>
                      <th>Demarcación</th>
                      <th>Ideal</th>
                      <th>Posibles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demarcationCounts.map((d) => (
                      <tr key={d.demId}>
                        <td>
                          <div className={styles.modalDemRow}>
                            <div className={styles.modalDemCode}>{d.code}</div>
                            <div className={styles.modalDemName}>{d.name}</div>
                          </div>
                        </td>
                        <td className={styles.modalCount}>{d.ideal}</td>
                        <td className={styles.modalCount}>{d.possible}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestGrid;
