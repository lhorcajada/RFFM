import { useMemo } from "react";
import type { PoolPlayer } from "../../SeasonPrep";

type PlayerGroup = {
  team: string;
  positions: Array<{ label: string; players: PoolPlayer[] }>;
};

function positionRank(pos: string): number {
  const p = pos.toLowerCase();
  if (p.includes("portero") || p.includes("keeper") || p.includes("arquero")) return 0;
  if (p.includes("defensa") || p.includes("central") || p.includes("lateral") || p.includes("libero")) return 1;
  if (p.includes("centrocampista") || p.includes("medio") || p.includes("pivote") || p.includes("interior") || p.includes("volante")) return 2;
  if (p.includes("delantero") || p.includes("extremo") || p.includes("punta") || p.includes("ariete") || p.includes("winger")) return 3;
  return 99;
}

/**
 * Groups players by team and then by position, sorted in tactical order
 * (GK → defenders → midfielders → forwards → unknown).
 */
export function usePlayerGroups(players: PoolPlayer[]): PlayerGroup[] {
  return useMemo(() => {
    const teamMap = new Map<string, PoolPlayer[]>();
    for (const p of players) {
      const key = p.team?.trim() || p.procedencia?.trim() || "Sin equipo";
      if (!teamMap.has(key)) teamMap.set(key, []);
      teamMap.get(key)!.push(p);
    }

    return Array.from(teamMap.entries()).map(([team, tplayers]) => {
      const posMap = new Map<string, PoolPlayer[]>();
      for (const p of tplayers) {
        const key = p.position?.trim() || "Sin demarcación";
        if (!posMap.has(key)) posMap.set(key, []);
        posMap.get(key)!.push(p);
      }
      const positions = Array.from(posMap.entries())
        .sort(([a], [b]) => {
          const ra = positionRank(a), rb = positionRank(b);
          if (ra !== rb) return ra - rb;
          if (a === "Sin demarcación") return 1;
          if (b === "Sin demarcación") return -1;
          return a.localeCompare(b, "es");
        })
        .map(([label, players]) => ({ label, players }));
      return { team, positions };
    });
  }, [players]);
}
