import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import PageHeader from "../../../../shared/components/ui/PageHeader/PageHeader";
import ActionBar from "../../../../shared/components/ui/ActionBar/ActionBar";

export default function Lottery() {
  const navigate = useNavigate();

  return (
    <BaseLayout>
      <PageHeader title="Lotería" subtitle="Sistema de sorteos y lotería" />
      <ActionBar>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/coach/dashboard")}
          variant="outlined"
          size="small"
        >
          Volver
        </Button>
      </ActionBar>
      <Box sx={{ p: 3 }}>{/* Contenido de lotería */}</Box>
    </BaseLayout>
  );
}
