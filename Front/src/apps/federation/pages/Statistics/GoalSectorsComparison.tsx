import React from "react";
import styles from "./GoalSectorsComparison.module.css";
import { getTeamsGoalSectorsComparison } from "../../services/api";
import type { TeamsGoalSectorsComparison } from "../../../../shared/utils/goalSectors";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import StatsControls from "../../../../shared/components/ui/StatsControls/StatsControls";
import settingsStyles from "../Settings/Settings.module.css";
import SectorChart from "../../../../shared/components/ui/SectorChart/SectorChart";
import SectorDataTable from "../../../../shared/components/ui/SectorDataTable/SectorDataTable";

export default function GoalSectorsComparison(): JSX.Element {
  const [data, setData] = React.useState<TeamsGoalSectorsComparison | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState({
    competitionId: "",
    groupId: "",
    team1: "",
    team2: "",
    loading: false,
  });

  function handleCompare(opts: {
    competitionId: string;
    groupId: string;
    team1: string;
    team2: string;
  }) {
    setLoading(true);
    setError(null);
    setData(null);

    getTeamsGoalSectorsComparison({
      teamCode: opts.team1,
      competitionId: opts.competitionId,
      groupId: opts.groupId,
      teamCode1: opts.team1,
      teamCode2: opts.team2,
    })
      .then((res) => {
        if (!res || !Array.isArray(res) || res.length === 0) {
          setError("No hay datos de sectores para la selección indicada.");
          return;
        }
        // API returns two teams in array; set data
        setData(res as TeamsGoalSectorsComparison);
      })
      .catch((e) => {
        setError(String(e));
      })
      .finally(() => setLoading(false));
  }

  return (
    <BaseLayout>
      <ContentLayout
        title="Comparativa: Goles por sectores de tiempo"
        actionBar={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() =>
                handleCompare({
                  competitionId: selection.competitionId,
                  groupId: selection.groupId,
                  team1: selection.team1,
                  team2: selection.team2,
                })
              }
              disabled={
                loading ||
                !selection.competitionId ||
                !selection.groupId ||
                !selection.team1 ||
                !selection.team2
              }
              startIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : undefined
              }
              size="small"
              sx={{
                textTransform: "none",
                minHeight: 40,
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                "&.Mui-disabled": { color: "#fff", opacity: 0.9 },
              }}
            >
              {loading ? "Comparando" : "Comparar"}
            </Button>
          </div>
        }
      >
        <Box className={styles.root}>
          <StatsControls
            onCompare={handleCompare}
            hideCompareButton
            onSelectionChange={(s) => setSelection(s)}
          />

          {loading && (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              <CircularProgress size={28} />
              <Typography color="textSecondary">Cargando...</Typography>
            </Box>
          )}
          {error && <Typography color="error">Error: {error}</Typography>}
          {data && data.length === 2 && (
            <>
              <SectorChart data={data as any} />

              {/* build merged rows to pass to the table */}
              {(() => {
                const t1 = data[0];
                const t2 = data[1];
                const map = new Map<string, { start: number; end: number }>();
                (t1?.sectors ?? []).forEach((s) =>
                  map.set(`${s.startMinute}-${s.endMinute}`, {
                    start: s.startMinute,
                    end: s.endMinute,
                  })
                );
                (t2?.sectors ?? []).forEach((s) =>
                  map.set(`${s.startMinute}-${s.endMinute}`, {
                    start: s.startMinute,
                    end: s.endMinute,
                  })
                );
                const merged = Array.from(map.values()).sort(
                  (a, b) => a.start - b.start
                );
                const rows = merged
                  .map((s) => {
                    const a = (t1?.sectors ?? []).find(
                      (x) => x.startMinute === s.start && x.endMinute === s.end
                    ) ?? {
                      startMinute: s.start,
                      endMinute: s.end,
                      goalsFor: 0,
                      goalsAgainst: 0,
                    };
                    const b = (t2?.sectors ?? []).find(
                      (x) => x.startMinute === s.start && x.endMinute === s.end
                    ) ?? {
                      startMinute: s.start,
                      endMinute: s.end,
                      goalsFor: 0,
                      goalsAgainst: 0,
                    };
                    return {
                      start: s.start,
                      end: s.end,
                      aGoals: a.goalsFor ?? 0,
                      aAgainst: a.goalsAgainst ?? 0,
                      bGoals: b.goalsFor ?? 0,
                      bAgainst: b.goalsAgainst ?? 0,
                    };
                  })
                  .filter(
                    (r) => r.aGoals || r.bGoals || r.aAgainst || r.bAgainst
                  );

                return (
                  <SectorDataTable
                    rows={rows}
                    teamAName={t1.teamName}
                    teamBName={t2.teamName}
                  />
                );
              })()}
            </>
          )}
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
