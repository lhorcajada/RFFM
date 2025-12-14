import React from "react";
import styles from "./RestItem.module.css";
import TeamInfo from "../MatchCard/TeamInfo";
import { resolveShield } from "../../../utils/match";

export default function RestItem({ item }: { item: any }) {
  const m = item.match ?? {};
  // Prefer the non-empty side (local or visitante). Use a sensible fallback.
  const localName = String(
    m.localTeamName ?? m.equipo_local ?? m.local ?? m.nombre ?? ""
  ).trim();
  const awayName = String(
    m.visitorTeamName ??
      m.awayTeamName ??
      m.equipo_visitante ??
      m.visitante ??
      ""
  ).trim();

  const localShield = resolveShield(
    String(
      m.localTeamImageUrl ??
        m.escudo_equipo_local_url ??
        m.escudo_equipo_local ??
        m.localImage ??
        ""
    )
  );
  const awayShield = resolveShield(
    String(
      m.visitorTeamImageUrl ??
        m.escudo_equipo_visitante_url ??
        m.escudo_equipo_visitante ??
        m.awayImage ??
        ""
    )
  );

  let displayName = localName || awayName || "";
  let displayShield = localShield || awayShield || "";
  // Extract optional positions (keep compatibility with multiple API shapes)
  const localTeamPosition =
    (m as any).LocalTeamPosition ??
    (m as any).localTeamPosition ??
    (m as any).local_position ??
    (m as any).posicion_local ??
    (m as any).posicion_equipo_local ??
    null;

  const awayTeamPosition =
    (m as any).VisitorTeamPosition ??
    (m as any).visitorTeamPosition ??
    (m as any).visitor_position ??
    (m as any).posicion_visitante ??
    (m as any).posicion_equipo_visitante ??
    null;
  // If one side explicitly says 'descansa', show the opponent (the team that actually rests)
  const localIsDesc = String(localName).trim().toLowerCase() === "descansa";
  const awayIsDesc = String(awayName).trim().toLowerCase() === "descansa";

  if (localIsDesc && awayName && awayName !== "-") {
    // visitor is the actual team that rests -> show local (opponent)
    displayName = awayName;
    displayShield = awayShield || displayShield;
  } else if (awayIsDesc && localName && localName !== "-") {
    // away = 'descansa' -> show local opponent
    displayName = localName;
    displayShield = localShield || displayShield;
  } else {
    // fallback: prefer non-empty
    if ((!displayName || displayName === "-") && (awayName || localName)) {
      displayName = awayName || localName || displayName;
      displayShield = awayShield || localShield || displayShield;
    }
  }

  return (
    <div className={styles.restItem}>
      {displayShield ? (
        <TeamInfo
          name={displayName}
          shieldSrc={displayShield}
          alt={displayName}
          position={localIsDesc ? awayTeamPosition : localTeamPosition}
        />
      ) : (
        <div className={styles.placeholder} aria-hidden>
          {displayName ? displayName.charAt(0).toUpperCase() : "?"}
        </div>
      )}
    </div>
  );
}
