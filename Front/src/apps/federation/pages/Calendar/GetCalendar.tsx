import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { CircularProgress, Typography, Tabs, Tab } from "@mui/material";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "./GetCalendar.module.css";
// calendar filters removed; page title is rendered below
import RoundPanel from "../../../../shared/components/ui/RoundPanel/RoundPanel";
import useCalendar from "../../../../shared/hooks/useCalendar";
import { useUser } from "../../../../shared/context/UserContext";
import { getSettingsForUser } from "../../services/federationApi";

export default function GetCalendar(): JSX.Element {
  const [selectedCompetition, setSelectedCompetition] = useState<
    string | undefined
  >(undefined);
  const { user } = useUser();
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined,
  );
  const [season] = useState<string>("21");
  const location = useLocation();
  const [noConfig, setNoConfig] = useState<boolean>(false);

  // Load primary configuration from API when user is available
  useEffect(() => {
    async function loadPrimary() {
      if (!user?.id) {
        setNoConfig(true);
        return;
      }
      try {
        const settings = await getSettingsForUser(user.id);
        if (!settings || settings.length === 0) {
          setNoConfig(true);
          return;
        }
        const primary = settings.find((s: any) => s.isPrimary) || settings[0];
        if (primary) {
          setSelectedCompetition(
            primary.competitionId || primary.competition?.id,
          );
          setSelectedGroup(primary.groupId || primary.group?.id);
          setNoConfig(false);
        } else {
          setNoConfig(true);
        }
      } catch (e) {
        setNoConfig(true);
      }
    }

    loadPrimary();
    window.addEventListener("rffm.saved_combinations_changed", loadPrimary);
    return () =>
      window.removeEventListener(
        "rffm.saved_combinations_changed",
        loadPrimary,
      );
  }, [user]);

  // Load calendar when competition/group changes
  // Use the useCalendar hook to load/normalize calendar data and handle auto-select
  const {
    calendar: hookCalendar,
    loading: hookLoading,
    selectedTab,
    setSelectedTab,
    rounds,
    matchesByRound,
  } = useCalendar({
    season,
    competition: selectedCompetition,
    group: selectedGroup,
    navKey:
      location && (location as any).state?.resetToCurrent
        ? String(location.key)
        : location.key,
  });

  const loading = hookLoading;
  const calendar = hookCalendar;
  const selectedRound =
    rounds && rounds.length > 0 ? rounds[selectedTab] : null;
  const selectedRoundNumber = selectedRound?.matchDayNumber;
  const selectedMatches = (() => {
    if (!selectedRoundNumber || selectedRoundNumber <= 0) return [];
    const cached = matchesByRound[selectedRoundNumber];
    if (cached) return cached;
    if (calendar?.round === selectedRoundNumber) {
      return calendar.matchDay?.matches || [];
    }
    return [];
  })();

  // (data loading, normalization and auto-select handled by `useCalendar`)

  return (
    <BaseLayout className={styles.paper}>
      <ContentLayout title={noConfig ? undefined : "Calendario"}>
        {noConfig ? (
          <EmptyState
            description={"No hay configuración principal guardada."}
          />
        ) : loading ? (
          <div className={styles.center}>
            <CircularProgress />
          </div>
        ) : !calendar ? (
          <Typography variant="body2">
            Selecciona temporada, competición y grupo para ver el calendario.
          </Typography>
        ) : (
          <div className={styles.tabsRoot}>
            {rounds.length === 0 ? (
              <EmptyState
                description={
                  "No hay jornadas disponibles para la selección actual."
                }
              />
            ) : (
              <>
                <Tabs
                  value={selectedTab}
                  onChange={(_, v) => setSelectedTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {rounds.map((r, i) => (
                    <Tab
                      key={r.matchDayNumber || i}
                      label={`Jornada ${r.matchDayNumber}`}
                    />
                  ))}
                </Tabs>

                <div>
                  {loading ? (
                    <div className={styles.center}>
                      <CircularProgress />
                    </div>
                  ) : selectedMatches.length === 0 ? (
                    <EmptyState
                      description={"No hay partidos para esta jornada."}
                    />
                  ) : (
                    <RoundPanel
                      round={{
                        jornada: selectedRoundNumber,
                        equipos: selectedMatches,
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
