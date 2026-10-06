import React from "react";
import { Link as RouterLink } from "react-router-dom";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { COACH_FEATURE_ROUTES } from "../../../../apps/coach/constants/featureRoutes";
import { useFeaturePermission } from "../../../hooks/useFeaturePermission";
import type {
  ClubMembership,
  MyMemberships,
  TeamMembership,
} from "../../../services/profile/profileService";
import { membershipRoleLabel } from "../membershipRoleLabels";
import cardStyles from "./ProfileCard.module.css";
import styles from "./MembershipsCard.module.css";

type Props = {
  memberships: MyMemberships;
};

function teamDashboardPath(teamId: string) {
  return `/coach/team-dashboard?teamId=${encodeURIComponent(teamId)}`;
}

function clubPath(club: ClubMembership, teams: TeamMembership[], canManageClubs: boolean): string | null {
  if (canManageClubs) return `/coach/clubs/dashboard/${encodeURIComponent(club.clubId)}`;
  const firstTeam = teams.find((team) => team.clubId === club.clubId);
  return firstTeam ? teamDashboardPath(firstTeam.teamId) : null;
}

export default function MembershipsCard({ memberships }: Props) {
  const { hasAccess: canManageClubs } = useFeaturePermission(COACH_FEATURE_ROUTES.ClubManagement);
  const { clubs, teams } = memberships;
  const isEmpty = clubs.length === 0 && teams.length === 0;

  return (
    <Paper className={cardStyles.card}>
      <Typography variant="h6" component="h2">
        Mis clubes y equipos
      </Typography>
      {isEmpty && (
        <Typography variant="body2" color="text.secondary">
          No estás vinculado a ningún club ni equipo
        </Typography>
      )}
      {clubs.length > 0 && (
        <div className={styles.section}>
          <Typography variant="subtitle2" component="h3">
            Clubes
          </Typography>
          <List dense disablePadding>
            {clubs.map((club) => {
              const path = clubPath(club, teams, canManageClubs);
              return (
                <ListItem key={club.clubId} className={styles.item} divider>
                  <span className={styles.itemText}>
                    {path ? (
                      <Link component={RouterLink} to={path} underline="hover">
                        {club.clubName}
                      </Link>
                    ) : (
                      <Typography component="span">{club.clubName}</Typography>
                    )}
                  </span>
                  <Chip size="small" label={membershipRoleLabel(club.role)} />
                </ListItem>
              );
            })}
          </List>
        </div>
      )}
      {teams.length > 0 && (
        <div className={styles.section}>
          <Typography variant="subtitle2" component="h3">
            Equipos
          </Typography>
          <List dense disablePadding>
            {teams.map((team) => (
              <ListItem key={team.teamId} className={styles.item} divider>
                <span className={styles.itemText}>
                  <Link component={RouterLink} to={teamDashboardPath(team.teamId)} underline="hover">
                    {team.teamName}
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {team.clubName}
                  </Typography>
                  {team.linkedPlayerName && (
                    <Typography variant="body2" color="text.secondary">
                      {`Jugador: ${team.linkedPlayerName}`}
                    </Typography>
                  )}
                </span>
                <Chip size="small" label={membershipRoleLabel(team.role)} />
              </ListItem>
            ))}
          </List>
        </div>
      )}
    </Paper>
  );
}
