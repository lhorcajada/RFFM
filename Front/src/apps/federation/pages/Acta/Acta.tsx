import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./Acta.module.css";
import pageHeaderStyles from "../../../../shared/components/ui/PageHeader/PageHeader.module.css";
import { getActa, getSettingsForUser } from "../../services/api";
import type { Acta as ActaType } from "../../types/acta";
import { Paper, Typography, CircularProgress } from "@mui/material";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import ActaHeaderDate from "../../components/acta/ActaHeaderDate/ActaHeaderDate";
import Lineup from "../../components/acta/Lineup/Lineup";
import Goals from "../../components/acta/Goals/Goals";
import Substitutions from "../../components/acta/Substitutions/Substitutions";
import Referees from "../../components/acta/Referees/Referees";
import TechnicalStaff from "../../components/acta/TechnicalStaff/TechnicalStaff";
import Amonestaciones from "../../components/acta/Amonestaciones/Amonestaciones";
import FieldInfo from "../../components/acta/FieldInfo/FieldInfo";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";

export default function Acta(): JSX.Element {
  const { codacta } = useParams();
  const navigate = useNavigate();
  const [acta, setActa] = useState<ActaType | null>(null);
  const [loading, setLoading] = useState(false);
  // Use the SavedCombo shape from settings (single canonical fields)
  type SavedCombo = {
    id: string;
    competitionId?: string;
    competitionName?: string;
    groupId?: string;
    groupName?: string;
    teamId?: string;
    teamName?: string;
    createdAt?: number;
    isPrimary?: boolean;
  };
  useEffect(() => {
    if (!codacta) return;
    setLoading(true);

    (async () => {
      try {
        // Obtain competition/group only from saved settings (primary combo)
        let competicion: string | undefined = undefined;
        let grupo: string | undefined = undefined;
        try {
          const userId = undefined; // keep wrapper caching behavior
          const saved = await getSettingsForUser(userId);
          if (Array.isArray(saved) && saved.length > 0) {
            const primary: SavedCombo = (saved.find((s: any) => s.isPrimary) ||
              saved[0]) as SavedCombo;
            competicion = primary.competitionId;
            grupo = primary.groupId;
          }
        } catch (e) {
          // ignore and let values be undefined
        }

        const r = await getActa(codacta, {
          temporada: "21",
          competicion,
          grupo,
        });
        setActa(r);
      } catch (e) {
        setActa(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [codacta]);

  if (loading)
    return (
      <BaseLayout>
        <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </div>
      </BaseLayout>
    );

  const content = (
    <ContentLayout
      title="Acta"
      subtitle={
        acta ? (
          <>
            <span>{`${acta.equipo_local} vs ${acta.equipo_visitante}`}</span>
            {acta.suspendido === "1" && (
              <span className={pageHeaderStyles.suspendedBadge}>
                Suspendido
              </span>
            )}
          </>
        ) : (
          ""
        )
      }
      actionBar={
        <div className={styles.actionBar}>
          <div />
          <div>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Volver al calendario
            </Button>
          </div>
        </div>
      }
    >
      <ActaHeaderDate source={acta ?? undefined} />

      {acta ? (
        <div className={styles.headerLayout}>
          <div className={styles.leftCol} />
          <div className={styles.rightCol}>
            <FieldInfo acta={acta as any} />
          </div>
        </div>
      ) : null}
      {!acta && (
        <Paper elevation={0} className={styles.noActa}>
          <EmptyState description={"No hay acta"} />
        </Paper>
      )}
      {acta && (
        <>
          <div className={styles.sectionGrid}>
            <div>
              <Lineup
                title="Local"
                players={acta.jugadores_equipo_local || []}
                goals={acta.goles_equipo_local || []}
                teamName={acta.equipo_local}
              />
            </div>

            <div>
              <Lineup
                title="Visitante"
                players={acta.jugadores_equipo_visitante || []}
                goals={acta.goles_equipo_visitante || []}
                teamName={acta.equipo_visitante}
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
              />
            </div>

            <div className={styles.fullWidth}>
              <Substitutions
                local={acta.sustituciones_equipo_local || []}
                away={acta.sustituciones_equipo_visitante || []}
              />
            </div>

            <div className={styles.fullWidth}>
              <Amonestaciones
                local={acta.tarjetas_equipo_local || acta.tarjetas_local || []}
                away={
                  acta.tarjetas_equipo_visitante ||
                  acta.tarjetas_visitante ||
                  []
                }
                others={acta.otras_tarjetas || []}
                localPlayers={acta.jugadores_equipo_local || []}
                awayPlayers={acta.jugadores_equipo_visitante || []}
                localTeamName={acta.equipo_local}
                awayTeamName={acta.equipo_visitante}
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
        </>
      )}
    </ContentLayout>
  );

  // Add a bottom spacer so the fixed footer never overlaps the final content
  const withSpacer = (
    <>
      {content}
      <div className={styles.bottomSpacer} aria-hidden="true" />
    </>
  );

  return <BaseLayout className={styles.container}>{withSpacer}</BaseLayout>;
}
