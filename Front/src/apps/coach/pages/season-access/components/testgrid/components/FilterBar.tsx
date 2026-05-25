import React, { useState } from 'react';
import styles from '../TestGrid.module.css';
import { STATUS_OPTIONS } from '../helper/helpers';
import type { Demarcation, Status } from '../types';
import { Button, Popover, Checkbox, FormControlLabel, Box, Typography } from '@mui/material';

interface Props {
  filterTeam: string;
  setFilterTeam: (v: string) => void;
  filterStatus: Status[];
  setFilterStatus: (v: Status[]) => void;
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
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);
  const handleToggleStatus = (s: Status) => {
    try { console.debug('[FilterBar] toggleStatus start', { s, before: filterStatus }); } catch {}
    if (filterStatus.includes(s)) {
      setFilterStatus(filterStatus.filter((x) => x !== s));
    } else {
      setFilterStatus([...filterStatus, s]);
    }
    try { console.debug('[FilterBar] toggleStatus after', { s }); } catch {}
  };

  const handleClose = () => setAnchorEl(null);
  return (
    <div className={styles.filterBar}>
      <input
        className={styles.filterInput}
        placeholder="Filtrar por equipo…"
        value={filterTeam}
        onChange={(e) => setFilterTeam(e.target.value)}
      />
      <div>
        <Button
          size="small"
          variant="outlined"
          className={styles.filterSelect}
          onClick={(e) => setAnchorEl(e.currentTarget as HTMLElement)}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          sx={{
            padding: '6px 12px',
            minWidth: '160px',
            fontSize: '13px',
            textTransform: 'none',
            height: '36px',
            alignItems: 'center',
          }}
        >
          {filterStatus.length === 0 ? 'Todos los estados' : `${filterStatus.length} seleccionado(s)`}
        </Button>
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          PaperProps={{
            sx: {
              background: 'linear-gradient(180deg, #12121b 0%, #0f1218 100%)',
              color: '#e8e8e8',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              border: '1px solid rgba(77,157,224,0.12)',
              mt: 1,
            },
          }}
        >
          <Box sx={{ p: 1, minWidth: 220 }}>
            <FormControlLabel
              control={<Checkbox checked={filterStatus.length === 0} onChange={() => { setFilterStatus([]); }} color="primary" />}
              label={<Typography variant="body2" sx={{ color: 'inherit' }}>Todos los estados</Typography>}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
              {STATUS_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  control={
                    <Checkbox
                      checked={filterStatus.includes(opt.value)}
                      onChange={() => handleToggleStatus(opt.value)}
                      color="primary"
                    />
                  }
                  label={<Typography variant="body2" sx={{ color: 'inherit' }}>{opt.label}</Typography>}
                />
              ))}
            </Box>
          </Box>
        </Popover>
      </div>
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
