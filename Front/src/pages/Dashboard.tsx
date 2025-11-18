import React from "react";
import { Link } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import DashboardCard from "../components/ui/DashboardCard";

export default function Dashboard(): JSX.Element {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <DashboardCard
        title="Configuración"
        description="Ajustes y preferencias de la aplicación."
        icon={<SettingsIcon style={{ fontSize: 40, color: "#05313b" }} />}
        to="/settings"
      />
    </div>
  );
}
