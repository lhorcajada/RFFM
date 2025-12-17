import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import { Box, Typography, CircularProgress, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import GroupIcon from "@mui/icons-material/Group";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import DashboardCard from "../../../../../shared/components/ui/DashboardCard/DashboardCard";
import styles from "../../Dashboard.module.css";
import localStyles from "./Dashboard.module.css";
import { useNavigate } from "react-router-dom";
import clubService from "../../../services/clubService";
import ClubHeader from "../../../components/ClubHeader/ClubHeader";

export default function ClubsDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clubName, setClubName] = useState<string | null>(null);
  const [emblemSrc, setEmblemSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const c = await clubService.getClubById(id as string);
        if (!mounted) return;
        setClubName(c?.name ?? null);

        if (c && (c as any).shieldUrl) {
          setEmblemSrc((c as any).shieldUrl);
        } else if (c) {
          try {
            const resp = await clubService.getClubEmblem(id as string);
            if (!mounted) return;
            if (resp && resp.data) {
              const blob = new Blob([resp.data], {
                type: resp.contentType ?? "image/png",
              });
              objectUrl = URL.createObjectURL(blob);
              setEmblemSrc(objectUrl);
            }
          } catch (e) {
            // ignore emblem load errors
          }
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

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
        subtitle={<ClubHeader clubId={id as string} />}
      >
        <div className={styles.container}>
          <div className={styles.cards}>
            <DashboardCard
              title="Plantilla"
              description="Entrenadores, directivos, ayudantes, etc."
              icon={<GroupIcon className={localStyles.icon} />}
              to={`/coach/clubs/${id}/staff`}
            />

            <DashboardCard
              title="Equipos"
              description="Gestión de equipos vinculados al club."
              icon={<SportsFootballIcon className={localStyles.icon} />}
              to={`/coach/clubs/${id}/teams`}
            />
          </div>
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
