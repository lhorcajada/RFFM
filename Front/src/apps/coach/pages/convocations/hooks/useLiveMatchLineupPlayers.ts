import { useMemo } from "react";
import type { SquadPlayer } from "../../squad/components/IdealLineup";
import { useConvocationManagement } from "./useConvocationManagement";
import { useDesconvocatoriasGrid } from "./useDesconvocatoriasGrid";
import { useConvocationPlayerViews } from "./useConvocationPlayerViews";
import { useTeamReadinessMap } from "./useTeamReadinessMap";

/** Jugadores disponibles para el partido en directo, con los mismos datos que en la
 *  ficha del partido (fotos, competitividad, rodaje, jornadas sin decisión técnica). */
export function useLiveMatchLineupPlayers(
  teamId: string,
  matchDate: string | undefined,
): { lineupPlayers: SquadPlayer[] } {
  const convocation = useConvocationManagement(teamId, matchDate);
  const grid = useDesconvocatoriasGrid(teamId, true);
  const readinessMap = useTeamReadinessMap(teamId);

  const excuseTypesById = useMemo(
    () => new Map(convocation.excuseTypes.map((e) => [e.id, { name: e.name, justified: e.justified }])),
    [convocation.excuseTypes],
  );

  const { lineupPlayers } = useConvocationPlayerViews({
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

  return { lineupPlayers };
}
