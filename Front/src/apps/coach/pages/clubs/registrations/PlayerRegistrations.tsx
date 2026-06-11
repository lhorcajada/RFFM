import React from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";
import styles from "./PlayerRegistrations.module.css";

export default function PlayerRegistrations() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);
  const seasonId = qs.get("seasonId") ?? undefined;

  const backToDashboard = () => {
    if (!id) {
      navigate("/coach/clubs");
      return;
    }

    navigate(`/coach/clubs/dashboard/${id}${seasonId ? `?seasonId=${seasonId}` : ""}`);
  };

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Inscripciones de jugadores"
        subtitle={id ? <ClubHeader clubId={id} /> : "Gestión de altas y renovaciones"}
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={backToDashboard}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
        }
      >
        <div className={styles.root}>
          <Paper className={styles.hero} elevation={0}>
            <Stack spacing={1.2}>
              <Typography variant="overline" className={styles.kicker}>
                Club
              </Typography>
              <Typography variant="h5" className={styles.title}>
                Inscripciones de jugadores
              </Typography>
              <Typography variant="body2" className={styles.description}>
                Aquí podrás centralizar las altas, renovaciones y el control de jugadores inscritos en este club.
              </Typography>
            </Stack>
          </Paper>

          <Paper className={styles.panel} elevation={0}>
            <Typography variant="subtitle1" className={styles.panelTitle}>
              Pantalla lista para conectar con la operativa real
            </Typography>
            <Typography variant="body2" className={styles.panelText}>
              La navegación ya está preparada. Cuando se añada la fuente de datos,
              esta vista podrá mostrar el listado y las acciones de inscripción.
            </Typography>
          </Paper>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}