import type { SubstitutionWindow } from "./simulation.types";
import type { SimSlotPlayer } from "./SimulationPlayerSlot";
import styles from "./SubstitutionHistoryPanel.module.css";

interface SubstitutionHistoryPanelProps {
  windows: SubstitutionWindow[];
  playersById: Record<string, SimSlotPlayer>;
}

export default function SubstitutionHistoryPanel({
  windows,
  playersById,
}: SubstitutionHistoryPanelProps) {
  if (windows.length === 0) return null;

  return (
    <div className={styles.root}>
      <div className={styles.header}>Ventanas de cambios</div>

      <div className={styles.windowList}>
        {windows.map((win, idx) => (
          <div key={idx} className={styles.window}>
            <div className={styles.windowMeta}>
              <span className={styles.windowBadge}>
                {win.isHalftime ? "D" : `#${win.windowIndex}`}
              </span>
              <span className={styles.windowMinute}>min {win.minute}</span>
              <span className={`${styles.halfPill} ${win.half === 2 ? styles.secondHalf : ""} ${win.isHalftime ? styles.halftimePill : ""}`}>
                {win.isHalftime ? "Descanso" : `${win.half}ª parte`}
              </span>
            </div>

            <div className={styles.swapList}>
              {win.swaps.map((swap, i) => {
                const inPlayer = playersById[swap.inPlayerId];
                const outPlayer = swap.outPlayerId ? playersById[swap.outPlayerId] : null;

                const inName = inPlayer
                  ? (inPlayer.alias?.trim() ||
                      inPlayer.displayName.split(" ").slice(0, 2).join(" "))
                  : swap.inPlayerId;
                const outName = outPlayer
                  ? (outPlayer.alias?.trim() ||
                      outPlayer.displayName.split(" ").slice(0, 2).join(" "))
                  : "—";

                return (
                  <div key={i} className={styles.swap}>
                    <span className={styles.swapIn}>
                      {inPlayer?.dorsal != null && (
                        <span className={styles.dorsal}>{inPlayer.dorsal}</span>
                      )}
                      ▲ {inName}
                    </span>
                    <span className={styles.swapArrow}>↕</span>
                    <span className={styles.swapOut}>
                      {outPlayer?.dorsal != null && (
                        <span className={styles.dorsal}>{outPlayer.dorsal}</span>
                      )}
                      ▼ {outName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
