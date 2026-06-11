import React from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupIcon from "@mui/icons-material/Group";
import PeopleIcon from "@mui/icons-material/People";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import DashboardCard from "../../../../../shared/components/ui/DashboardCard/DashboardCard";
import styles from "../../Dashboard/Dashboard.module.css";
import localStyles from "./Dashboard.module.css";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";

export default function ClubsDashboard() {
  const { id } = useParams();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);
  const seasonId = qs.get("seasonId") ?? undefined;
  const navigate = useNavigate();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Panel de control del club"
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/coach/dashboard")}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
        }
        subtitle={id ? <ClubHeader clubId={id} /> : "-"}
      >
        <div className={styles.container}>
          <div className={styles.cards}>
            <DashboardCard
              title="Personal del club"
              description="Entrenadores, directivos, ayudantes, etc."
              icon={<GroupIcon className={localStyles.icon} />}
              to={`/coach/clubs/${id}/staff${
                seasonId ? `?seasonId=${seasonId}` : ""
              }`}
            />

            <DashboardCard
              title="Jugadores del club"
              description="Listado general de jugadores registrados en el club."
              icon={<PeopleIcon className={localStyles.icon} />}
              to={`/coach/clubs/${id}/players${
                seasonId ? `?seasonId=${seasonId}` : ""
              }`}
            />

            <DashboardCard
              title="Equipos"
              description="Gestión de equipos vinculados al club."
              icon={<SportsFootballIcon className={localStyles.icon} />}
              to={`/coach/clubs/${id}/teams${
                seasonId ? `?seasonId=${seasonId}` : ""
              }`}
            />

            <DashboardCard
              title="Inscripciones de jugadores"
              description="Altas, renovaciones y control de accesos."
              icon={<HowToRegIcon className={localStyles.icon} />}
              to={`/coach/clubs/${id}/registrations${
                seasonId ? `?seasonId=${seasonId}` : ""
              }`}
            />
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
