import React from "react";
import styles from "./SectorDataTable.module.css";
import type { SectorComparisonRow } from "../../../utils/goalSectors";

type TeamColumn = {
  teamIndex: 0 | 1;
  name: string;
  range: (r: SectorComparisonRow) => string;
  goals: (r: SectorComparisonRow) => number;
  against: (r: SectorComparisonRow) => number;
};

export default function SectorDataTable({
  rows,
  teamAName,
  teamBName,
  onGoalsAgainstClick,
}: {
  rows: SectorComparisonRow[];
  teamAName?: string;
  teamBName?: string;
  onGoalsAgainstClick?: (row: SectorComparisonRow, teamIndex: 0 | 1) => void;
}) {
  const columns: TeamColumn[] = [
    {
      teamIndex: 0,
      name: teamAName ?? "Equipo A",
      range: (r) => `${r.aStart}-${r.aEnd}’`,
      goals: (r) => r.aGoals,
      against: (r) => r.aAgainst,
    },
    {
      teamIndex: 1,
      name: teamBName ?? "Equipo B",
      range: (r) => `${r.bStart}-${r.bEnd}’`,
      goals: (r) => r.bGoals,
      against: (r) => r.bAgainst,
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {columns.map((col) => (
          <div key={col.teamIndex} className={styles.card}>
            {rows.map((r) => (
              <div key={r.index} className={styles.row}>
                <div>
                  <div className={styles.label}>{col.range(r)}</div>
                  <div className={styles.label}>{col.name}</div>
                </div>
                <div>
                  <div className={styles.value}>{col.goals(r)} GF</div>
                  {onGoalsAgainstClick ? (
                    <button
                      type="button"
                      className={styles.goalsAgainstButton}
                      onClick={() => onGoalsAgainstClick(r, col.teamIndex)}
                      aria-label={`${col.name} ${col.range(r)} goles en contra`}
                    >
                      {col.against(r)} GC
                    </button>
                  ) : (
                    <div className={styles.value} style={{ color: "#ef4444" }}>
                      {col.against(r)} GC
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
