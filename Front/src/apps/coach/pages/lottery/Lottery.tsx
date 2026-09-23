import { Box, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import useTeamDashboardBack from "../../hooks/useTeamDashboardBack";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";

export default function Lottery() {
  useAuditPageAccess('Lottery');
  const goToTeamDashboard = useTeamDashboardBack();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Lotería"
        subtitle="Sistema de sorteos y lotería"
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => goToTeamDashboard()}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
        }
      >
        <Box sx={{ p: 3 }}>{/* Contenido de lotería */}</Box>
      </ContentLayout>
    </BaseLayout>
  );
}
