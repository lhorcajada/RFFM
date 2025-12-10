import React, { useEffect, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import styles from "./AppHeader.module.css";
import { getSettingsForUser } from "../../../services/federationApi";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import { useUser } from "../../../../../shared/context/UserContext";

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title = "Federación" }: AppHeaderProps) {
  const { user } = useUser();
  const [competition, setCompetition] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [team, setTeam] = useState<string>("");

  useEffect(() => {
    console.log("AppHeader: user changed", { user, hasId: !!user?.id });

    if (user?.id) {
      console.log("AppHeader: user.id available, loading settings");
      loadPrimarySettings();
    }

    function handleSettingsChanged() {
      loadPrimarySettings();
    }

    window.addEventListener(
      "rffm.saved_combinations_changed",
      handleSettingsChanged
    );
    return () =>
      window.removeEventListener(
        "rffm.saved_combinations_changed",
        handleSettingsChanged
      );
  }, [user]);

  async function loadPrimarySettings() {
    // Sólo llamar a la API si hay user.id en contexto
    if (!user?.id) {
      console.log(
        "AppHeader.loadPrimarySettings: no user.id, skipping API call"
      );
      return;
    }

    try {
      console.log(
        "AppHeader.loadPrimarySettings: fetching with userId=",
        user.id
      );
      const settings = await getSettingsForUser(user.id);
      console.log(
        "AppHeader.loadPrimarySettings: settings.count=",
        Array.isArray(settings) ? settings.length : typeof settings
      );
      const primary = settings.find((s: any) => s.isPrimary);
      if (primary) {
        setCompetition(primary.competitionName || "");
        setGroup(primary.groupName || "");
        setTeam(primary.teamName || "");
      } else {
        setCompetition("");
        setGroup("");
        setTeam("");
      }
    } catch {
      setCompetition("");
      setGroup("");
      setTeam("");
    }
  }

  return (
    <AppBar position="static" className={styles.appBar} color="transparent">
      <Toolbar className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <div className={styles.titleColumn}>
            <Typography variant="h6" component="div" className={styles.appName}>
              {title}
            </Typography>
            {team && (
              <Typography variant="body2" className={styles.teamUnderTitle}>
                {team}
              </Typography>
            )}
          </div>
          {(competition || group || user) && (
            <div className={styles.cornerWrap}>
              <Typography
                variant="body1"
                className={styles.competition}
                sx={{
                  fontSize: { xs: "0.5rem", sm: "0.95rem" },
                  lineHeight: 1,
                }}
              >
                {competition}
              </Typography>
              {group && (
                <Typography
                  variant="body2"
                  className={styles.group}
                  sx={{
                    fontSize: { xs: "0.45rem", sm: "0.82rem" },
                    lineHeight: 1,
                  }}
                >
                  {group}
                </Typography>
              )}
              {user && (
                <Box className={styles.userSection}>
                  <Avatar
                    src={user.avatar}
                    alt={user.username}
                    className={styles.avatar}
                  >
                    {user.username?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" className={styles.username}>
                    {user.username}
                  </Typography>
                </Box>
              )}
            </div>
          )}
        </div>
      </Toolbar>
    </AppBar>
  );
}
