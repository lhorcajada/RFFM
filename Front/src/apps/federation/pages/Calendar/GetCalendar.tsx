import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { CircularProgress, Typography, Tabs, Tab } from "@mui/material";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import styles from "./GetCalendar.module.css";
import useMatch, { computeMatchData } from "../../../../shared/hooks/useMatch";
// calendar filters removed; page title is rendered below
import RoundPanel from "../../../../shared/components/ui/RoundPanel/RoundPanel";
import useCalendar from "../../../../shared/hooks/useCalendar";
import { useUser } from "../../../../shared/context/UserContext";
import { getSettingsForUser } from "../../services/federationApi";

const STORAGE_PRIMARY = "rffm.primary_combination_id";
const STORAGE_KEY = "rffm.saved_combinations_v1";

export default function GetCalendar(): JSX.Element {
  const [selectedCompetition, setSelectedCompetition] = useState<
    string | undefined
  >(undefined);
  const { user } = useUser();
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined
  );
  const [season] = useState<string>("21");
  // loading/calendar state provided by useCalendar
  const [selectedTab, setSelectedTab] = useState<number>(0);
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
            primary.competitionId || primary.competition?.id
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
        loadPrimary
      );
  }, [user]);

  // Load calendar when competition/group changes
  // Use the useCalendar hook to load/normalize calendar data and handle auto-select
  const {
    calendar: hookCalendar,
    rounds: hookRounds,
    visibleRounds: hookVisible,
    loading: hookLoading,
    error: hookError,
    selectedTab: hookSelectedTab,
    setSelectedTab: setHookSelectedTab,
  } = useCalendar({
    season,
    competition: selectedCompetition,
    group: selectedGroup,
    navKey:
      location && (location as any).state?.resetToCurrent
        ? String(location.key)
        : location.key,
  });

  useEffect(() => {
    if (typeof hookSelectedTab === "number") setSelectedTab(hookSelectedTab);
  }, [hookSelectedTab]);

  useEffect(() => {
    setHookSelectedTab(selectedTab);
  }, [selectedTab]);

  const loading = hookLoading;
  const calendar = hookCalendar;
  const visibleRounds = hookVisible || [];

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
            {visibleRounds.length === 0 ? (
              <EmptyState
                description={
                  "No hay jornadas con partidos para la selección actual."
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
                  {visibleRounds.map((r: any, i: number) => (
                    <Tab key={i} label={`Jornada ${i + 1}`} />
                  ))}
                </Tabs>

                {visibleRounds.map((r: any, i: number) => (
                  <div key={i} hidden={selectedTab !== i}>
                    <RoundPanel round={r} />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
