import { useMemo } from "react";
import { useConvocationManagement, type ConvocationManagementReturn } from "./useConvocationManagement";
import { useDesconvocatoriasGrid } from "./useDesconvocatoriasGrid";
import { useConvocationPlayerViews, type ConvocationPlayerViews } from "./useConvocationPlayerViews";
import { useTeamReadinessMap } from "./useTeamReadinessMap";

export type MatchSquad = Pick<
  ConvocationPlayerViews,
  "lineupPlayers" | "notCalledPlayers" | "pendingPlayers" | "notAttendingPlayers"
> & {
  convocation: ConvocationManagementReturn;
};

/** Plantilla del partido con los mismos datos que en la ficha del partido (fotos,
 *  competitividad, rodaje, jornadas sin decisión técnica), para las pantallas completas
 *  de alineación, simulación y partido en directo. */
export function useMatchSquad(teamId: string, matchDate: string | undefined): MatchSquad {
  const convocation = useConvocationManagement(teamId, matchDate);
  const grid = useDesconvocatoriasGrid(teamId, true);
  const readinessMap = useTeamReadinessMap(teamId);

  const excuseTypesById = useMemo(
    () => new Map(convocation.excuseTypes.map((e) => [e.id, { name: e.name, justified: e.justified }])),
    [convocation.excuseTypes],
  );

  const { lineupPlayers, notCalledPlayers, pendingPlayers, notAttendingPlayers } = useConvocationPlayerViews({
    players: convocation.players,
    mgmtNotCalled: convocation.mgmtNotCalled,
    mgmtPending: convocation.mgmtPending,
    mgmtPhotos: convocation.mgmtPhotos,
    mgmtRatings: convocation.mgmtRatings,
    matchColumns: grid.matchColumns,
    enrichedGrid: grid.enrichedGrid,
    readinessMap,
    assistanceMap: convocation.mgmtAssistanceMap,
    excuseMap: convocation.mgmtExcuseMap,
    excuseTypesById,
  });

  return { convocation, lineupPlayers, notCalledPlayers, pendingPlayers, notAttendingPlayers };
}
