import React, { useEffect, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import styles from "./AppHeader.module.css";

const STORAGE_PRIMARY = "rffm.primary_combination_id";
const STORAGE_KEY = "rffm.saved_combinations_v1";

export default function AppHeader() {
  const [competition, setCompetition] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [team, setTeam] = useState<string>("");

  useEffect(() => {
    const primaryId = localStorage.getItem(STORAGE_PRIMARY);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!primaryId || !stored) return;
    try {
      const combos = JSON.parse(stored);
      const primary = combos.find((c: any) => c.id === primaryId);
      if (primary) {
        setCompetition(primary.competition?.name || "");
        setGroup(primary.group?.name || "");
        setTeam(primary.team?.name || "");
      }
    } catch {}
  }, []);

  return (
    <AppBar position="static" className={styles.appBar}>
      <Toolbar className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <div className={styles.titleColumn}>
            <Typography variant="h6" component="div" className={styles.appName}>
              RFFM App
            </Typography>
            {team && (
              <Typography variant="body2" className={styles.teamUnderTitle}>
                {team}
              </Typography>
            )}
          </div>
          {(competition || group) && (
            <div className={styles.cornerWrap}>
              <Typography variant="body1" className={styles.competition}>
                {competition}
              </Typography>
              {group && (
                <Typography variant="body2" className={styles.group}>
                  {group}
                </Typography>
              )}
            </div>
          )}
        </div>
      </Toolbar>
    </AppBar>
  );
}
