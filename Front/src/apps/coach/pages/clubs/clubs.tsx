import { Box, Button, Grid, CircularProgress, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import React, { useEffect, useState } from "react";
import styles from "./Clubs.module.css";
import Typography from "@mui/material/Typography";
import clubService from "../../services/clubService";
import type { UserClubsApiResponse } from "../../types/userClubs";
import ClubCard from "./ClubCard";

export default function Clubs() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<UserClubsApiResponse>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedClubs, setCheckedClubs] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await clubService.getUserClubs();
        if (!mounted) return;
        setClubs(data);
        setCheckedClubs(true);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? "Error loading clubs");
        setCheckedClubs(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Clubs"
        subtitle="Gestión de clubs"
        actionBar={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/coach/dashboard")}
              variant="outlined"
              size="small"
              className={styles.actionButton}
            >
              Volver
            </Button>
            {!loading && !error && checkedClubs && clubs.length === 0 && (
              <Button
                variant="contained"
                onClick={() => navigate("/coach/clubs/create")}
                size="small"
              >
                Añadir club
              </Button>
            )}
          </>
        }
      >
        {/* If user has no clubs, show inline message with CTA */}
        {!loading && !error && checkedClubs && clubs.length === 0 && (
          <Box className={styles.noClubs}>
            <Typography>Actualmente no perteneces a ningún club.</Typography>
          </Box>
        )}
        <Box className={styles.wrapper}>
          {loading && (
            <Box className={styles.loadingBox}>
              <CircularProgress />
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && (
            <Grid container spacing={2} className={styles.gridContainer}>
              {clubs.map((c) => (
                <Grid item key={c.clubId} xs={12} sm={6} md={4}>
                  <ClubCard id={c.clubId} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
