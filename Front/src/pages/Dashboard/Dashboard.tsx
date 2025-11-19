import SettingsIcon from "@mui/icons-material/Settings";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import BaseLayout from "../../components/ui/BaseLayout/BaseLayout";
import DashboardCard from "../../components/ui/DashboardCard/DashboardCard";

export default function Dashboard(): JSX.Element {
  return (
    <BaseLayout>
      <PageHeader
        title="Panel de Control"
        subtitle="Resumen y accesos rápidos"
      />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <DashboardCard
          title="Configuración"
          description="Ajustes y preferencias de la aplicación."
          icon={<SettingsIcon style={{ fontSize: 40, color: "#05313b" }} />}
          to="/settings"
        />
      </div>
    </BaseLayout>
  );
}
