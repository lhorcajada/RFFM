import React from 'react';
import styles from '../TestGrid.module.css';
import type { Status } from '../types';

interface DemCount { demId: number; code: string; name: string; ideal: number; possible: number }

interface Props {
  openStatusPopup: Status | null;
  setOpenStatusPopup: (s: Status | null) => void;
  demarcationCounts: DemCount[];
  statusBadgeLabels: Record<Status, string>;
}

export default function StatusModal({ openStatusPopup, setOpenStatusPopup, demarcationCounts, statusBadgeLabels }: Props) {
  if (!openStatusPopup) return null;
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" onClick={() => setOpenStatusPopup(null)}>
      <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Demarcaciones — {statusBadgeLabels[openStatusPopup]}</h3>
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
  );
}
