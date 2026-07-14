import SettingsIcon from "@mui/icons-material/Settings";
import CircularProgress from "@mui/material/CircularProgress";
import { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import DashboardCard from "../../../../../shared/components/ui/DashboardCard/DashboardCard";
import styles from "../Dashboard.module.css";
import { useUserTeams } from "../hooks/useUserTeams";
import { fetchImage } from "../../../../../shared/services/imageService";
import teamService from "../../../services/teamService";
import clubService from "../../../services/clubService";
import { usePermissions } from "../../../../../shared/hooks/usePermissions";
import { COACH_FEATURE_ROUTES } from "../../../constants/featureRoutes";

interface DashboardCardsProps {
  selectedSeason: string;
  isPlayer?: boolean;
}

export default function DashboardCards({
  selectedSeason,
  isPlayer = false,
}: DashboardCardsProps) {
  const [teamPhotos, setTeamPhotos] = useState<Record<string, string | null>>({});
  const { teams: userTeams, loading: loadingUserTeams } = useUserTeams();
  const { hasFeatureAccess } = usePermissions();

  const seasonParam = selectedSeason ? `?seasonId=${selectedSeason}` : "";
  const seasonSuffix = selectedSeason ? `&seasonId=${selectedSeason}` : "";

  useEffect(() => {
    let mounted = true;
    let createdObjUrls: string[] = [];

    async function loadTeamPhotos() {
      const photos: Record<string, string | null> = {};

      for (const t of userTeams) {
        try {
          let imgSrc: string | null = null;
          if (t.urlPhoto) {
            const obj = await teamService.fetchTeamPhoto(t.urlPhoto);
            if (obj) {
              imgSrc = obj;
              createdObjUrls.push(obj);
            }
          }

          if (!imgSrc && t.club?.id) {
            try {
              const emblem = await clubService.getClubEmblem(t.club.id);
              if (emblem && emblem.data) {
                const blob = new Blob([emblem.data], {
                  type: emblem.contentType ?? "image/png",
                });
                const url = URL.createObjectURL(blob);
                imgSrc = url;
                createdObjUrls.push(url);
              } else if (t.club.emblemUrl) {
                imgSrc = await fetchImage(t.club.emblemUrl);
              }
            } catch (e) {
              if (t.club.emblemUrl) imgSrc = await fetchImage(t.club.emblemUrl);
            }
          }

          if (mounted) {
            photos[t.id] = imgSrc ?? null;
          }
        } catch (err) {
          console.error("Error loading team photo:", err);
          if (mounted) {
            photos[t.id] = null;
          }
        }
      }

      if (mounted) {
        setTeamPhotos(photos);
      }
    }

    if (userTeams.length > 0) {
      loadTeamPhotos();
    }

    return () => {
      mounted = false;
      createdObjUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [userTeams]);

  const buildTeamDashboardRoute = (teamId?: string | null) =>
    teamId
      ? `/coach/team-dashboard?teamId=${teamId}${seasonSuffix}`
      : `/coach/team-dashboard${seasonParam}`;

  return (
    <div className={styles.container}>
      {((!isPlayer && (userTeams.length > 0 || loadingUserTeams)) || !isPlayer) && (
        <div className={styles.teamsSection}>
          {(userTeams.length > 0 || loadingUserTeams) && (
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: "primary.main" }}>
              Acceso Rápido
            </Typography>
          )}

          {loadingUserTeams && (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <CircularProgress />
            </div>
          )}

          <div className={styles.cards}>
            {!isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.Settings) && (
              <DashboardCard
                title="Configuración"
                description="Ajustes y preferencias."
                icon={<SettingsIcon style={{ fontSize: 40 }} />}
                to="/coach/settings"
              />
            )}
            {userTeams.length > 0 && !loadingUserTeams &&
              userTeams.map((t) => (
                <DashboardCard
                  key={t.id}
                  title={t.name}
                  description={`${t.category.name} • ${t.club.name}`}
                  icon={
                    <Avatar
                      src={teamPhotos[t.id] ?? undefined}
                      alt={t.name}
                      sx={{ width: 40, height: 40 }}
                    />
                  }
                  to={buildTeamDashboardRoute(t.id)}
                />
              ))
            }
          </div>
        </div>
      )}

    </div>
  );
}
