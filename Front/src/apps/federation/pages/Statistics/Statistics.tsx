import React from "react";
import styles from "./Statistics.module.css";
import StatsCard from "../../../../shared/components/ui/StatsCard/StatsCard";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export default function Statistics(): JSX.Element {
  return (
    <BaseLayout>
      <Box className={styles.root}>
        <Typography variant="h5" className={styles.title} gutterBottom>
          Estadísticas
        </Typography>

        <div className={styles.container}>
          <StatsCard />
        </div>
      </Box>
    </BaseLayout>
  );
}
