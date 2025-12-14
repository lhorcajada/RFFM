import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";

export default function Settings() {
  const navigate = useNavigate();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title="Configuración"
        subtitle="Gestiona tu configuración y preferencias"
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
        <Box sx={{ p: 3 }}>{/* Contenido de configuración */}</Box>
      </ContentLayout>
    </BaseLayout>
  );
}
