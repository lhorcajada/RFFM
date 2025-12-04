import React from "react";
import styles from "./SectorDataTable.module.css";

type Row = {
  start: number;
  end: number;
  aGoals: number;
  aAgainst: number;
  bGoals: number;
  bAgainst: number;
};

export default function SectorDataTable({
  rows,
  teamAName,
  teamBName,
}: {
  rows: Row[];
  teamAName?: string;
  teamBName?: string;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        <div className={styles.card}>
          {rows.map((r) => (
            <div key={`${r.start}-${r.end}`} className={styles.row}>
              <div>
                <div className={styles.label}>{`${r.start}-${r.end}’`}</div>
                <div className={styles.label}>{teamAName ?? "Equipo A"}</div>
              </div>
              <div>
                <div className={styles.value}>{r.aGoals} GF</div>
                <div className={styles.value} style={{ color: "#ef4444" }}>
                  {r.aAgainst} GC
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.card}>
          {rows.map((r) => (
            <div key={`${r.start}-${r.end}`} className={styles.row}>
              <div>
                <div className={styles.label}>{`${r.start}-${r.end}’`}</div>
                <div className={styles.label}>{teamBName ?? "Equipo B"}</div>
              </div>
              <div>
                <div className={styles.value}>{r.bGoals} GF</div>
                <div className={styles.value} style={{ color: "#ef4444" }}>
                  {r.bAgainst} GC
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
