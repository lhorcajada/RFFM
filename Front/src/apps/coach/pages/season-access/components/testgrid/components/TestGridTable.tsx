import React, { useEffect, useState } from 'react';
import styles from '../TestGrid.module.css';
import type { Player, Demarcation } from '../types';

interface Props {
  sorted: Player[];
  demarcations: Demarcation[];
  updatePlayer: <K extends keyof Player>(id: number, field: K, value: Player[K]) => void;
  togglePossible: (playerId: number, demarcationId: number) => void;
  removePlayer: (id: number) => Promise<void> | void;
  sortBy: { key: keyof Player | null; dir: 'asc' | 'desc' };
  toggleSort: (k: keyof Player) => void;
}

export default function TestGridTable({ sorted, demarcations, updatePlayer, togglePossible, removePlayer, sortBy, toggleSort }: Props) {
  type LocalRow = { birthYear: string; totalGoals: string; rating: string };
  const [localValues, setLocalValues] = useState<Record<number, LocalRow>>({});

  useEffect(() => {
    const map: Record<number, LocalRow> = {};
    sorted.forEach((p) => {
      map[p.id] = {
        birthYear: p.birthYear != null ? String(p.birthYear) : '',
        totalGoals: p.totalGoals != null ? String(p.totalGoals) : '',
        rating: p.rating != null ? String(p.rating) : '',
      };
    });
    setLocalValues(map);
  }, [sorted]);

  const setLocal = (id: number, patch: Partial<LocalRow>) =>
    setLocalValues((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { birthYear: '', totalGoals: '', rating: '' }), ...patch } }));

  const currentYear = new Date().getFullYear();

  const handleBlurBirthYear = (p: Player) => {
    const v = localValues[p.id]?.birthYear ?? String(p.birthYear);
    if (v === '') {
      // revert to original if left empty
      setLocal(p.id, { birthYear: String(p.birthYear) });
      return;
    }
    const n = Number(v);
    if (Number.isNaN(n)) {
      setLocal(p.id, { birthYear: String(p.birthYear) });
      return;
    }
    const clamped = Math.max(1900, Math.min(currentYear, Math.trunc(n)));
    if (clamped !== p.birthYear) updatePlayer(p.id, 'birthYear', clamped as any);
    setLocal(p.id, { birthYear: String(clamped) });
  };

  const handleBlurTotalGoals = (p: Player) => {
    const v = localValues[p.id]?.totalGoals ?? (p.totalGoals != null ? String(p.totalGoals) : '');
    if (v === '') {
      updatePlayer(p.id, 'totalGoals' as keyof Player, null as any);
      setLocal(p.id, { totalGoals: '' });
      return;
    }
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) {
      setLocal(p.id, { totalGoals: p.totalGoals != null ? String(p.totalGoals) : '' });
      return;
    }
    const clamped = Math.trunc(Math.max(0, n));
    if (clamped !== (p.totalGoals ?? null)) updatePlayer(p.id, 'totalGoals' as keyof Player, clamped as any);
    setLocal(p.id, { totalGoals: String(clamped) });
  };

  const handleBlurRating = (p: Player) => {
    const v = localValues[p.id]?.rating ?? String(p.rating);
    if (v === '') {
      setLocal(p.id, { rating: String(p.rating) });
      return;
    }
    const n = Number(v);
    if (Number.isNaN(n)) {
      setLocal(p.id, { rating: String(p.rating) });
      return;
    }
    const clamped = Math.trunc(Math.max(0, Math.min(100, n)));
    if (clamped !== p.rating) updatePlayer(p.id, 'rating', clamped as any);
    setLocal(p.id, { rating: String(clamped) });
  };
  const sortIcon = (key: keyof Player) =>
    sortBy.key === key ? (
      <span className={styles.sortIcon}>{sortBy.dir === 'asc' ? '▲' : '▼'}</span>
    ) : (
      <span className={styles.sortIconInactive}>⇅</span>
    );

  return (
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
            <tr key={String(p.id)} className={styles.tr}>
              <td className={styles.td}>
                <input className={styles.input} value={p.name} onChange={(e) => updatePlayer(p.id, 'name', e.target.value)} />
              </td>
              <td className={styles.tdNarrow}>
                <input
                  className={styles.input}
                  type="number"
                  value={localValues[p.id]?.birthYear ?? String(p.birthYear)}
                  onChange={(e) => setLocal(p.id, { birthYear: e.target.value })}
                  onBlur={() => handleBlurBirthYear(p)}
                  min={1900}
                  max={new Date().getFullYear()}
                />
              </td>
              <td className={styles.td}>
                <input className={styles.input} value={p.teamName ?? ''} placeholder="Equipo" onChange={(e) => updatePlayer(p.id, 'teamName' as keyof Player, e.target.value as any)} />
              </td>
              <td className={styles.td}>
                <input className={styles.input} value={p.category ?? ''} placeholder="Categoría" onChange={(e) => updatePlayer(p.id, 'category' as keyof Player, e.target.value as any)} />
              </td>
              <td className={styles.tdNarrow}>
                <select className={`${styles.select} ${styles[`status-${p.status}`]}`} value={p.status} onChange={(e) => updatePlayer(p.id, 'status', e.target.value as any)}>
                  <option value="descartado">Descartado</option>
                  <option value="poco">Poco interés</option>
                  <option value="interesado">Interesado</option>
                  <option value="solicitado">Solicitado</option>
                  <option value="seleccionado">Seleccionado</option>
                </select>
              </td>
              <td className={styles.tdNarrow}>
                <select
                  className={styles.select}
                  value={p.idealDemarcationId != null ? String(p.idealDemarcationId) : ''}
                  onChange={(e) => updatePlayer(p.id, 'idealDemarcationId' as keyof Player, e.target.value === '' ? (null as any) : (Number(e.target.value) as any))}
                >
                  <option value="">—</option>
                  {demarcations.map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.code}</option>
                  ))}
                </select>
              </td>
              <td className={styles.td}>
                <div className={styles.chipRow}>
                  {demarcations.map((d) => {
                    const active = (p.possibleDemarcationIds ?? []).includes(d.id);
                    return (
                      <button key={d.id} type="button" className={`${styles.demChip} ${active ? styles.demChipActive : ''}`} onClick={() => togglePossible(p.id, d.id)}>
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
                  value={localValues[p.id]?.totalGoals ?? (p.totalGoals != null ? String(p.totalGoals) : '')}
                  placeholder="-"
                  onChange={(e) => setLocal(p.id, { totalGoals: e.target.value })}
                  onBlur={() => handleBlurTotalGoals(p)}
                />
              </td>
              <td className={styles.tdNarrow}>
                <input
                  className={styles.input}
                  type="number"
                  value={localValues[p.id]?.rating ?? String(p.rating)}
                  onChange={(e) => setLocal(p.id, { rating: e.target.value })}
                  onBlur={() => handleBlurRating(p)}
                  min={0}
                  max={100}
                />
              </td>
              <td className={styles.tdAction}>
                <button type="button" className={styles.deleteRowBtn} onClick={() => void removePlayer(p.id)} title="Eliminar jugador">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
