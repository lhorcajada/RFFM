import React, { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import GoleadoresList from "../../components/players/GoleadoresList/GoleadoresList";
import { getGoleadores, getSettingsForUser } from "../../services/api";
import { useUser } from "../../../../shared/context/UserContext";
import { Goleador } from "../../types/goleador";
import Grid from "@mui/material/Grid";
import CompetitionSelector from "../../../../shared/components/ui/CompetitionSelector/CompetitionSelector";
import GroupSelector from "../../../../shared/components/ui/GroupSelector/GroupSelector";
import styles from "./Goleadores.module.css";

const Goleadores: React.FC = () => {
  const [goleadores, setGoleadores] = useState<Goleador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCompetition, setSelectedCompetition] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);

  const { user } = useUser();

  function handleCompetitionChange(c?: { id: string; name: string; categoryGroup: string }) {
    if (c?.id !== selectedCompetition) {
      setSelectedGroup(undefined);
    }
    setSelectedCompetition(c?.id);
  }

  function handleGroupChange(g?: { id: string; name: string }) {
    setSelectedGroup(g?.id);
  }

  useEffect(() => {
    async function loadSettings() {
      if (user?.id) {
        try {
          const settings = await getSettingsForUser(user.id);
          if (Array.isArray(settings) && settings.length > 0) {
            const primary = settings.find((s: any) => s.isPrimary) || settings[0];
            setSelectedCompetition(primary.competitionId || primary.competition?.id);
            setSelectedGroup(primary.groupId || primary.group?.id);
          }
        } catch (e) {
          // ignore and use defaults
        }
      }
    }
    loadSettings();
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!selectedCompetition || !selectedGroup) {
        setGoleadores([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getGoleadores(selectedCompetition, selectedGroup);
        setGoleadores(data);
      } catch (err) {
        setError("Error al cargar los goleadores");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedCompetition, selectedGroup]);

  return (
    <BaseLayout>
      <ContentLayout
        title="Goleadores"
        subtitle="Máximos goleadores de la competición"
      >
        <div className={styles.filters}>
          <Grid container spacing={1} className={styles.filtersGrid}>
            <Grid item xs={12} sm={6}>
              <CompetitionSelector
                onChange={handleCompetitionChange}
                value={selectedCompetition}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <GroupSelector
                competitionId={selectedCompetition}
                onChange={handleGroupChange}
                value={selectedGroup}
              />
            </Grid>
          </Grid>
        </div>

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
                    <EmptyState
                      description={"No hay goleadores disponibles."}
                    />
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
      </ContentLayout>
    </BaseLayout>
  );
};

export default Goleadores;
