import React from "react";
import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import BaseLayout from "../../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../../shared/components/ui/ContentLayout/ContentLayout";
import ActionBar from "../../../../../shared/components/ui/ActionBar/ActionBar";
import styles from "./NewPlayer.module.css";

export default function NewPlayer() {
  const navigate = useNavigate();

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout
        title={"Añadir jugador"}
        subtitle={"Crea un nuevo jugador y asígnalo a la plantilla"}
        actionBar={
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(-1)}
            >
              Volver
            </Button>
            <Button variant="contained" size="small">
              Guardar
            </Button>
          </>
        }
      >
        <Box className={styles.container}>
          {/* Formulario base: aquí añadiremos campos más adelante */}
          <div className={styles.emptyState}>
            Formulario de jugador (pendiente)
          </div>
        </Box>
      </ContentLayout>
    </BaseLayout>
  );
}
