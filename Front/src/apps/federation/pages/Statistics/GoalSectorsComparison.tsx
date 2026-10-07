import React from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import styles from "./GoalSectorsComparison.module.css";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import SectorChart from "../../../../shared/components/ui/SectorChart/SectorChart";
import SectorDataTable from "../../../../shared/components/ui/SectorDataTable/SectorDataTable";
import GoalSectorsComparisonDialog from "./Components/GoalSectorsComparisonDialog";
import GoalSectorsComparisonFilters, {
  isSelectionComplete,
} from "./Components/GoalSectorsComparisonFilters";
import { useGoalSectorsComparison } from "./hooks/useGoalSectorsComparison";

export default function GoalSectorsComparison(): JSX.Element {
  const {
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
          <Button
            variant="contained"
            color="primary"
            onClick={handleCompare}
            disabled={loading || !isSelectionComplete(selection)}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
            size="small"
            sx={{
              textTransform: "none",
              minHeight: 40,
              padding: "8px 12px",
              "&.Mui-disabled": { color: "#fff", opacity: 0.9 },
            }}
          >
            {loading ? "Comparando" : "Comparar"}
          </Button>
        }
      >
        <Box className={styles.root}>
          <GoalSectorsComparisonFilters value={selection} onChange={setSelection} />

          {loading && (
            <Box className={styles.loading}>
              <CircularProgress size={28} />
              <Typography color="textSecondary">Cargando...</Typography>
            </Box>
          )}
          {error && <Typography color="error">Error: {error}</Typography>}
          {comparison.teamA && comparison.teamB && (
            <>
              <SectorChart
                teamA={comparison.teamA}
                teamB={comparison.teamB}
                rows={comparison.rows}
              />
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
