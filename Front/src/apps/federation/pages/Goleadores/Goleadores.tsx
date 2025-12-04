import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import PageHeader from "../../../../shared/components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import GoleadoresList from "../../components/players/GoleadoresList/GoleadoresList";
import { getGoleadores } from "../../services/api";
import { Goleador } from "../../types/goleador";
import styles from "./Goleadores.module.css";

const Goleadores: React.FC = () => {
  const [goleadores, setGoleadores] = useState<Goleador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rffm.current_selection");
      let competitionId = "25255269";
      let groupId = "25255283";
      if (raw) {
        try {
          const combo = JSON.parse(raw);
          if (combo && combo.competition && combo.competition.id)
            competitionId = String(combo.competition.id);
          if (combo && combo.group && combo.group.id)
            groupId = String(combo.group.id);
        } catch (e) {
          // ignore parse errors and fallback to defaults
        }
      }

      getGoleadores(competitionId, groupId)
        .then((data) => {
          setGoleadores(data);
          setLoading(false);
        })
        .catch((err) => {
          setError("Error al cargar los goleadores");
          setLoading(false);
        });
    } catch (e) {
      // fallback: try default call
      getGoleadores("25255269", "25255283")
        .then((data) => {
          setGoleadores(data);
          setLoading(false);
        })
        .catch((err) => {
          setError("Error al cargar los goleadores");
          setLoading(false);
        });
    }
  }, []);

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
