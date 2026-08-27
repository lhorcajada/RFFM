import React from "react";
import HeightIcon from "@mui/icons-material/Height";
import MonitorWeightIcon from "@mui/icons-material/MonitorWeight";
import DirectionsRunIcon from "@mui/icons-material/DirectionsRun";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import styles from "../PlayerDetail.module.css";
import { TeamPlayerResponse } from "../../../services/teamplayerService";

type Props = { teamPlayer: TeamPlayerResponse };

function Tile({
  icon,
  label,
  value,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.infoTile} ${wide ? styles.infoTileWide : ""}`}>
      <div className={styles.infoTileLabel}>
        {icon} {label}
      </div>
      <div className={`${styles.infoTileValue} ${value ? "" : styles.infoTileValueEmpty}`}>
        {value || "Sin datos"}
      </div>
    </div>
  );
}

export default function PhysicalInfo({ teamPlayer }: Props) {
  const height = teamPlayer.physicalInfo?.height;
  const weight = teamPlayer.physicalInfo?.weight;

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Datos físicos</h3>
        <div className={styles.infoGrid}>
          <Tile icon={<HeightIcon fontSize="inherit" />} label="Altura" value={height ? `${height} cm` : null} />
          <Tile icon={<MonitorWeightIcon fontSize="inherit" />} label="Peso" value={weight ? `${weight} kg` : null} />
          <Tile
            icon={<DirectionsRunIcon fontSize="inherit" />}
            label="Pie dominante"
            value={teamPlayer.physicalInfo?.dominantFoot}
          />
          <Tile
            icon={<HealthAndSafetyIcon fontSize="inherit" />}
            label="Enfermedades"
            value={teamPlayer.player?.enfermedades}
            wide
          />
          <Tile
            icon={<WarningAmberIcon fontSize="inherit" />}
            label="Alergias"
            value={teamPlayer.player?.alergias}
            wide
          />
        </div>
      </div>
    </div>
  );
}
