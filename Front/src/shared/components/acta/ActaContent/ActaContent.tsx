import type { Acta } from "../../../types/acta";
import Lineup from "../Lineup/Lineup";
import Goals from "../Goals/Goals";
import Substitutions from "../Substitutions/Substitutions";
import Amonestaciones from "../Amonestaciones/Amonestaciones";
import TechnicalStaff from "../TechnicalStaff/TechnicalStaff";
import Referees from "../Referees/Referees";
import FieldInfo from "../FieldInfo/FieldInfo";
import styles from "./ActaContent.module.css";

type Props = {
  acta: Acta;
  onPlayerClick?: (playerCode: string, playerName?: string) => void;
};

export default function ActaContent({ acta, onPlayerClick }: Props) {
  return (
    <div className={styles.sectionGrid}>
      <div>
        <Lineup
          title="Local"
          players={acta.jugadores_equipo_local || []}
          goals={acta.goles_equipo_local || []}
          teamName={acta.equipo_local}
          onPlayerClick={onPlayerClick}
        />
      </div>

      <div>
        <Lineup
          title="Visitante"
          players={acta.jugadores_equipo_visitante || []}
          goals={acta.goles_equipo_visitante || []}
          teamName={acta.equipo_visitante}
          onPlayerClick={onPlayerClick}
        />
      </div>

      <div className={styles.fullWidth}>
        <Goals
          localGoals={acta.goles_equipo_local || []}
          awayGoals={acta.goles_equipo_visitante || []}
          localPlayers={acta.jugadores_equipo_local || []}
          awayPlayers={acta.jugadores_equipo_visitante || []}
          localTeamName={acta.equipo_local}
          awayTeamName={acta.equipo_visitante}
          onPlayerClick={onPlayerClick}
        />
      </div>

      <div className={styles.fullWidth}>
        <Substitutions
          local={acta.sustituciones_equipo_local || []}
          away={acta.sustituciones_equipo_visitante || []}
          onPlayerClick={onPlayerClick}
        />
      </div>

      <div className={styles.fullWidth}>
        <Amonestaciones
          local={acta.tarjetas_equipo_local || acta.tarjetas_local || []}
          away={acta.tarjetas_equipo_visitante || acta.tarjetas_visitante || []}
          others={acta.otras_tarjetas || []}
          localPlayers={acta.jugadores_equipo_local || []}
          awayPlayers={acta.jugadores_equipo_visitante || []}
          localTeamName={acta.equipo_local}
          awayTeamName={acta.equipo_visitante}
          onPlayerClick={onPlayerClick}
        />
      </div>

      <div className={styles.fullWidth}>
        <TechnicalStaff
          local={acta.otros_tecnicos_local || []}
          away={acta.otros_tecnicos_visitante || []}
          entrenador_local={acta.entrenador_local}
          entrenador_visitante={acta.entrenador_visitante}
          delegadolocal={acta.delegadolocal}
          delegado_visitante={acta.delegado_visitante}
        />
      </div>

      <div className={styles.fullWidth}>
        <Referees refs={acta.arbitros_partido || []} />
      </div>

      <div className={styles.fullWidth}>
        <FieldInfo acta={acta} />
      </div>
    </div>
  );
}
