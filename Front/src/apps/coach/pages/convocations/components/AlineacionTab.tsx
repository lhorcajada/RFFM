import type { RefObject } from "react";
import EmptyState from "../../../../../shared/components/ui/EmptyState/EmptyState";
import IdealLineup, {
  type IdealLineupHandle,
  type SquadPlayer,
} from "../../squad/components/IdealLineup";
import styles from "./AlineacionTab.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  mgmtEventId: string | null;
  lineupPlayers: SquadPlayer[];
  notCalledPlayers?: SquadPlayer[];
  lineupRef: RefObject<IdealLineupHandle | null>;
  teamId: string;
  onSavingChange: (saving: boolean) => void;
  onDeconvoke?: (playerId: string) => void;
  onReconvoke?: (playerId: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlineacionTab({
  mgmtEventId,
  lineupPlayers,
  notCalledPlayers = [],
  lineupRef,
  teamId,
  onSavingChange,
  onDeconvoke,
  onReconvoke,
}: Props) {
  if (!mgmtEventId) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}>
          <EmptyState description="No se encontró el partido en el sistema interno. Asegúrate de que el evento esté creado en el área de Partidos del equipo." />
        </div>
      </div>
    );
  }

  if (lineupPlayers.length === 0) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.center}>
          <EmptyState description="No hay jugadores disponibles para la alineación." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.alineacionBody}>
        <div className={styles.idealLineupWrapper}>
          <IdealLineup
            ref={lineupRef}
            players={lineupPlayers}
            teamId={teamId}
            seasonId={mgmtEventId}
            panelTitle="Banquillo"
            hideInternalSave
            onSavingChange={onSavingChange}
            onDeconvoke={onDeconvoke}
          />
        </div>

        <div className={styles.desconvocadosPanel}>
          <div className={styles.desconvocadosHeader}>
            <span>Desconvocados</span>
            <span className={styles.desconvocadosBadge}>{notCalledPlayers.length}</span>
          </div>
          <div className={styles.desconvocadosList}>
            {notCalledPlayers.length === 0 ? (
              <p className={styles.desconvocadosEmpty}>Ninguno</p>
            ) : (
              notCalledPlayers.map((p) => (
                <div key={p.id} className={styles.desconvocadosItem}>
                  {p.dorsal != null && (
                    <span className={styles.desconvocadosDorsal}>{p.dorsal}</span>
                  )}
                  <span className={styles.desconvocadosName}>{p.displayName}</span>
                  {p.isInjured && (
                    <span className={styles.desconvocadosInjuryTag} title="Lesionado">🏥</span>
                  )}
                  {!p.isInjured && onReconvoke && (
                    <button
                      type="button"
                      className={styles.desconvocadosReconvokeBtn}
                      title="Pasar al banquillo"
                      onClick={() => onReconvoke(p.id)}
                    >
                      ↩
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
