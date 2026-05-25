import React from 'react';
import styles from '../TestGrid.module.css';
import { STATUS_OPTIONS, STATUS_BADGE_LABELS } from '../helper/helpers';
import type { Status } from '../types';

interface Props {
  statusCounts: Record<Status, number>;
  teamsByStatus: Record<Status, Record<string, number>>;
  setOpenStatusPopup: (s: Status | null) => void;
  addPlayer: () => void;
  handleExport: () => Promise<void>;
  exporting: boolean;
  playersLength: number;
}

export default function Toolbar({ statusCounts, teamsByStatus, setOpenStatusPopup, addPlayer, handleExport, exporting, playersLength }: Props) {
  return (
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
              aria-label={`${STATUS_BADGE_LABELS[opt.value]}: ${statusCounts[opt.value]}`}
            >
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
        <button type="button" className={styles.addRowBtn} onClick={addPlayer}>+ Añadir jugador</button>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={() => void handleExport()}
          disabled={exporting || playersLength === 0}
          title="Descargar Excel"
        >
          {exporting ? 'Exportando…' : '⬇ Excel'}
        </button>
      </div>
    </div>
  );
}
