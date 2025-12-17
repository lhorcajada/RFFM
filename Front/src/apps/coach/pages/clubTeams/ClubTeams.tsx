import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../components/ClubHeader/ClubHeader";
import styles from "./ClubTeams.module.css";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Paper } from "@mui/material";
import teamService, { TeamResponse } from "../../services/teamService";

export default function ClubTeams() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await teamService.getTeams(id);
        if (!mounted) return;
        setTeams(data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Error cargando equipos");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <BaseLayout>
      <ContentLayout
        title="Equipos"
        subtitle={id ? <ClubHeader clubId={id} /> : "-"}
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/coach/clubs/dashboard/${id}`)}
              variant="outlined"
              size="small"
              className={styles.actionButton}
            >
              Volver
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(`/coach/clubs/${id}/teams/create`)}
              size="small"
            >
              Añadir equipo
            </Button>
          </>
        }
      >
        <Box className={styles.page}>
          <div className={styles.list}>
            {loading && <div className={styles.teamCard}>Cargando...</div>}
            {error && <div className={styles.teamCard}>{error}</div>}
            {!loading && !error && teams.length === 0 && (
              <div className={styles.teamCard}>
                <EmptyState description={"No hay equipos por mostrar."} />
              </div>
            )}
            {!loading &&
              !error &&
              teams.map((t) => (
                <Paper key={t.id} elevation={1} className={styles.teamCard}>
                  <div className={styles.teamTitle}>{t.name}</div>
                  <div className={styles.teamMeta}>
                    <span>{t.category?.name}</span>
                    {t.league?.name && <span> — {t.league.name}</span>}
                  </div>
                </Paper>
              ))}
          </div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
