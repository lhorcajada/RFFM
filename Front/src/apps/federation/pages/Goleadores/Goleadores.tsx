import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import PageHeader from "../../../../shared/components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import GoleadoresList from "../../components/players/GoleadoresList/GoleadoresList";
import { getGoleadores, getSettingsForUser } from "../../services/api";
import { useUser } from "../../../../shared/context/UserContext";
import { Goleador } from "../../types/goleador";
import styles from "./Goleadores.module.css";

const Goleadores: React.FC = () => {
  const [goleadores, setGoleadores] = useState<Goleador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useUser();

  useEffect(() => {
    async function load() {
      let competitionId = "25255269";
      let groupId = "25255283";
      if (user?.id) {
        try {
          const settings = await getSettingsForUser(user.id);
          if (Array.isArray(settings) && settings.length > 0) {
            const primary =
              settings.find((s: any) => s.isPrimary) || settings[0];
            competitionId =
              primary.competitionId || primary.competition?.id || competitionId;
            groupId = primary.groupId || primary.group?.id || groupId;
          }
        } catch (e) {
          // ignore and use defaults
        }
      }

      try {
        const data = await getGoleadores(competitionId, groupId);
        setGoleadores(data);
      } catch (err) {
        setError("Error al cargar los goleadores");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  return (
    <BaseLayout>
      <PageHeader
        title="Goleadores"
        subtitle="Máximos goleadores de la competición"
      />
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.headerBar} />
          {loading && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <CircularProgress />
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
          {!loading && !error && (
            <div className={styles.grid}>
              {goleadores.length === 0 ? (
                <div className={styles.empty}>
                  No hay goleadores disponibles.
                </div>
              ) : (
                goleadores.map((goleador, idx) => (
                  <GoleadoresList
                    key={goleador.playerId}
                    goleador={goleador}
                    position={idx + 1}
                    totalPlayers={goleadores.length}
                  />
                ))
              )}
              <div className={styles.gridEndSpacer} aria-hidden />
            </div>
          )}
        </div>
      </div>
    </BaseLayout>
  );
};

export default Goleadores;
