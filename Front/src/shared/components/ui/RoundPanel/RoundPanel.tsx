import React from "react";
import { groupMatchesByWeekend } from "../../../utils/calendar";
import MatchDayView from "../MatchDay/MatchDay";

export default function RoundPanel({
  round,
  hideActaButton,
  resolveActaLink,
}: {
  round: any;
  hideActaButton?: boolean;
  resolveActaLink?: (codacta: string) => string | null;
}) {
  const allMatches = round.equipos ?? round.partidos ?? round.matches ?? [];
  const grouped = groupMatchesByWeekend(allMatches);

  const saturdayDate = grouped.saturday[0]?.parsedDate
    ? grouped.saturday[0].parsedDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
      })
    : "";

  const sundayDate = grouped.sunday[0]?.parsedDate
    ? grouped.sunday[0].parsedDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <>
      {grouped.saturday.length > 0 && (
        <MatchDayView
          title={`Sábado ${saturdayDate}`}
          items={grouped.saturday}
          hideActaButton={hideActaButton}
          resolveActaLink={resolveActaLink}
        />
      )}
      {grouped.sunday.length > 0 && (
        <MatchDayView
          title={`Domingo ${sundayDate}`}
          items={grouped.sunday}
          hideActaButton={hideActaButton}
          resolveActaLink={resolveActaLink}
        />
      )}
      {grouped.postponed.length > 0 && (
        <MatchDayView
          title={`Aplazados`}
          items={grouped.postponed}
          hideActaButton={hideActaButton}
          resolveActaLink={resolveActaLink}
        />
      )}
      {grouped.byes && grouped.byes.length > 0 && (
        <MatchDayView title={`Descansa`} items={grouped.byes} />
      )}
    </>
  );
}
