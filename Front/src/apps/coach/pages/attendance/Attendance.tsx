import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";

export default function Attendance() {
  const navigate = useNavigate();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Asistencias"
        subtitle="Control de asistencias de jugadores"
        actionBar={
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/coach/dashboard")}
            variant="outlined"
            size="small"
          >
            Volver
          </Button>
        }
      >
        <Box sx={{ p: 3 }}>{/* Contenido de asistencias */}</Box>
      </ContentLayout>
    </BaseLayout>
  );
}
