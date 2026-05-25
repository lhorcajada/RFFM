import React from 'react';
import styles from '../TestGrid.module.css';
import { STATUS_OPTIONS } from '../helper/helpers';
import type { Demarcation, Status } from '../types';

interface Props {
  filterTeam: string;
  setFilterTeam: (v: string) => void;
  filterStatus: Status | '';
  setFilterStatus: (v: Status | '') => void;
  filterDemarcation: number | '';
  setFilterDemarcation: (v: number | '') => void;
  demarcations: Demarcation[];
  hasFilters: boolean;
  clearFilters: () => void;
  filteredLength: number;
  totalLength: number;
}

export default function FilterBar({
  filterTeam,
  setFilterTeam,
  filterStatus,
  setFilterStatus,
  filterDemarcation,
  setFilterDemarcation,
  demarcations,
  hasFilters,
  clearFilters,
  filteredLength,
  totalLength,
}: Props) {
  return (
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
          onClick={clearFilters}
        >
          ✕ Limpiar filtros
        </button>
      )}
      <span className={styles.filterCount} aria-live="polite">
        <span className={styles.filterCountBadge} aria-hidden>{filteredLength}</span>
        <span className={styles.filterCountTotal}>/ {totalLength}</span>
      </span>
    </div>
  );
}
