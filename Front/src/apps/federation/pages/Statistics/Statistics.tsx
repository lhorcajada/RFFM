import React from "react";
import styles from "./Statistics.module.css";
import StatsCard from "../../../../shared/components/ui/StatsCard/StatsCard";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import { useAuditPageAccess } from "../../../../shared/hooks/useAuditPageAccess";

export default function Statistics(): JSX.Element {
  useAuditPageAccess('Statistics');
  return (
    <BaseLayout>
      <ContentLayout
        title="Estadísticas"
        subtitle="Análisis y datos del equipo"
      >
        <div className={styles.container}>
          <StatsCard />
        </div>
      </ContentLayout>
    </BaseLayout>
  );
}
