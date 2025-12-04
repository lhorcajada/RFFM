import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../../../shared/components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import { CircularProgress, Typography, Tabs, Tab } from "@mui/material";
import styles from "./GetCalendar.module.css";
import useMatch, { computeMatchData } from "../../../../shared/hooks/useMatch";
// calendar filters removed; page title is rendered below
import RoundPanel from "../../../../shared/components/ui/RoundPanel/RoundPanel";
import useCalendar from "../../../../shared/hooks/useCalendar";

const STORAGE_PRIMARY = "rffm.primary_combination_id";
const STORAGE_KEY = "rffm.saved_combinations_v1";

export default function GetCalendar(): JSX.Element {
  const [selectedCompetition, setSelectedCompetition] = useState<
    string | undefined
  >(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined
  );
  const [season] = useState<string>("21");
  // loading/calendar state provided by useCalendar
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const location = useLocation();
  const [noConfig, setNoConfig] = useState<boolean>(false);

  // Load primary configuration on mount
  useEffect(() => {
    // Prefer explicit current selection (applied from Settings) if present
    try {
      const cur = localStorage.getItem("rffm.current_selection");
      if (cur) {
        try {
          const combo = JSON.parse(cur);
          if (combo) {
            setSelectedCompetition(combo.competition?.id);
            setSelectedGroup(combo.group?.id);
            setNoConfig(false);
            return;
          }
        } catch (e) {
          // fall through to saved combos
        }
      }

      const primaryId = localStorage.getItem(STORAGE_PRIMARY);
      if (!primaryId) {
        setNoConfig(true);
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setNoConfig(true);
        return;
      }
      const combos = JSON.parse(stored) as any[];
      let primary: any = null;
      if (Array.isArray(combos) && combos.length > 0) {
        // Try to find by stored primary id (compare as strings)
        const foundById = combos.find(
          (c: any) => String(c.id) === String(primaryId)
        );
        if (foundById) primary = foundById;
        // Fallback to explicit isPrimary flag
        if (!primary)
          primary = combos.find((c: any) => c.isPrimary) || combos[0];
      }

      if (primary) {
        setSelectedCompetition(primary.competition?.id);
        setSelectedGroup(primary.group?.id);
        setNoConfig(false);
      } else {
        setNoConfig(true);
      }
    } catch (e) {
      setNoConfig(true);
    }
  }, []);

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
      {noConfig ? (
        <Typography variant="body2">
          No hay configuración principal guardada.
        </Typography>
      ) : (
        <PageHeader title="Calendario" />
      )}

      {/* page header is shown in the global layout */}

      {loading ? (
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
            <Typography variant="body2">
              No hay jornadas con partidos para la selección actual.
            </Typography>
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
    </BaseLayout>
  );
}
