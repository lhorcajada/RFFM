import React from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import styles from "./GoalSectorsComparison.module.css";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import StatsControls from "../../../../shared/components/ui/StatsControls/StatsControls";
import SectorChart from "../../../../shared/components/ui/SectorChart/SectorChart";
import SectorDataTable from "../../../../shared/components/ui/SectorDataTable/SectorDataTable";
import GoalSectorsComparisonDialog from "./Components/GoalSectorsComparisonDialog";
import { useGoalSectorsComparison } from "./hooks/useGoalSectorsComparison";

export default function GoalSectorsComparison(): JSX.Element {
  const {
    data,
    comparison,
    loading,
    error,
    selection,
    setSelection,
    handleCompare,
    sectorPopup,
    closePopup,
    handleGoalsAgainstClick,
  } = useGoalSectorsComparison();

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
          {comparison.teamA && comparison.teamB && (
            <>
              <SectorChart data={data as any} />
              <SectorDataTable
                rows={comparison.rows}
                teamAName={comparison.teamA.teamName}
                teamBName={comparison.teamB.teamName}
                onGoalsAgainstClick={handleGoalsAgainstClick}
              />
            </>
          )}
        </Box>
      </ContentLayout>

      <GoalSectorsComparisonDialog popup={sectorPopup} onClose={closePopup} />
    </BaseLayout>
  );
}
