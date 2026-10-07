import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import type { SquadPlayer } from "../../squad/components/IdealLineup";
import PlayerFormLegend from "../../../components/PlayerFormLegend/PlayerFormLegend";
import { BenchPlayerCard, groupBenchPlayers } from "./simulation/BenchPlayerCard";
import liveStyles from "./PartidoEnDirectoTab.module.css";
import simStyles from "./SimulacionTab.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onFieldPlayers: SquadPlayer[];
  benchPlayers: SquadPlayer[];
  minutesById: Record<string, number>;
  hasPlayed: (playerId: string) => boolean;
  /** Banquillo durante "preparar cambio": jugadores que salen del campo. */
  isLeaving: (playerId: string) => boolean;
};

/** Popup "Jugadores" del partido en directo y de la simulación: listados ricos, de solo
 *  lectura, de "En el campo" y "Banquillo". Cada grupo de posición es su propio bloque
 *  (etiqueta + tarjetas) para que la etiqueta nunca quede sola al final de una fila. */
export default function MatchPlayersDialog({
  open,
  onClose,
  onFieldPlayers,
  benchPlayers,
  minutesById,
  hasPlayed,
  isLeaving,
}: Props) {
  const renderPositionGroups = (players: SquadPlayer[], isLeavingPlayer: (id: string) => boolean) => (
    <div className={liveStyles.positionGroups}>
      {groupBenchPlayers(players).map((group) => (
        <div key={group.label} role="group" aria-label={group.label} className={liveStyles.positionGroup}>
          <div className={simStyles.benchGroupSeparator} style={{ borderLeftColor: group.color }}>
            <span className={simStyles.benchGroupSeparatorLabel}>{group.label}</span>
            <span className={simStyles.benchGroupSeparatorCount}>{group.players.length}</span>
          </div>
          <div className={liveStyles.positionGroupCards}>
            {group.players.map((p) => (
              <BenchPlayerCard
                key={p.id}
                player={p}
                isDragActive={false}
                isLeaving={isLeavingPlayer(p.id)}
                minutesPlayed={minutesById[p.id] ?? 0}
                hasPlayed={hasPlayed(p.id)}
                groupColor={group.color}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "#19192e",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 3,
          m: 2,
          width: "calc(100% - 32px)",
          height: "calc(100% - 32px)",
          maxHeight: "none",
        },
      }}
    >
      <DialogTitle sx={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700, py: 1.5 }}>
        Jugadores
      </DialogTitle>
      <DialogContent className={liveStyles.playersDialogContent}>
        <div className={liveStyles.playersLists}>
          <div className={`${simStyles.onFieldPanel} ${liveStyles.playersPanel}`}>
            <div className={simStyles.panelHeader}>
              En el campo
              <span className={simStyles.panelBadge}>{onFieldPlayers.length}</span>
            </div>
            <div className={liveStyles.playersPanelBody}>
              {onFieldPlayers.length === 0 ? (
                <p className={simStyles.emptyBench}>No hay jugadores en el campo</p>
              ) : (
                renderPositionGroups(onFieldPlayers, () => false)
              )}
            </div>
          </div>

          <div className={`${simStyles.benchInfoPanel} ${liveStyles.playersPanel}`}>
            <div className={simStyles.panelHeader}>
              Banquillo
              <span className={simStyles.panelBadge}>{benchPlayers.length}</span>
            </div>
            <div className={simStyles.panelLegend}>
              <span className={simStyles.legendItem}>
                <span className={`${simStyles.benchCompTag} ${simStyles.benchCompMid}`} style={{ fontSize: "0.5rem" }}>Comp.</span> Competitividad
              </span>
              <span className={simStyles.legendItem}>
                <span className={simStyles.benchMinTag} style={{ fontSize: "0.5rem" }}>0&apos;</span> Minutos
              </span>
              <span className={simStyles.legendItem}>
                <span className={simStyles.benchStreakBadge} style={{ fontSize: "0.5rem" }}>⏱ N</span> Jornadas sin decisión técnica
              </span>
              <PlayerFormLegend />
            </div>
            <div className={liveStyles.playersPanelBody}>
              {benchPlayers.length === 0 ? (
                <p className={simStyles.emptyBench}>No hay jugadores en el banquillo</p>
              ) : (
                renderPositionGroups(benchPlayers, isLeaving)
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} variant="contained" size="small">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
