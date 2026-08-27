import React from "react";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import HomeIcon from "@mui/icons-material/Home";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import FlightLandIcon from "@mui/icons-material/FlightLand";
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

export default function ContactInfo({ teamPlayer }: Props) {
  const address = teamPlayer.contactInfo?.address;
  const cityAndPostalCode = [address?.city, address?.postalCode].filter(Boolean).join(" · ");

  return (
    <div className={styles.card}>
      <div className={styles.sectionInner}>
        <h3>Información de contacto</h3>
        <div className={styles.infoGrid}>
          <Tile icon={<PhoneIcon fontSize="inherit" />} label="Teléfono" value={teamPlayer.contactInfo?.phone} />
          <Tile icon={<EmailIcon fontSize="inherit" />} label="Email" value={teamPlayer.contactInfo?.email} wide />
          <Tile icon={<HomeIcon fontSize="inherit" />} label="Calle" value={address?.street} wide />
          <Tile icon={<LocationCityIcon fontSize="inherit" />} label="Ciudad / CP" value={cityAndPostalCode} />
          <Tile icon={<FlightLandIcon fontSize="inherit" />} label="Procedencia" value={teamPlayer.player?.procedencia} />
        </div>
      </div>
    </div>
  );
}
