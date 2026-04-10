import type { MatchSimulation } from "../pages/convocations/components/simulation/simulation.types";

const KEY_PREFIX = "rffm_sim" as const;

function makeKey(teamId: string, eventId: string, id: string): string {
  return `${KEY_PREFIX}:${teamId}:${eventId}:${id}`;
}

function prefixFor(teamId: string, eventId: string): string {
  return `${KEY_PREFIX}:${teamId}:${eventId}:`;
}

export function listSimulations(teamId: string, eventId: string): MatchSimulation[] {
  const prefix = prefixFor(teamId, eventId);
  const results: MatchSimulation[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (raw) results.push(JSON.parse(raw) as MatchSimulation);
    } catch {
      // ignore corrupt entries
    }
  }

  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function saveSimulation(sim: MatchSimulation): void {
  const key = makeKey(sim.teamId, sim.eventId, sim.id);
  localStorage.setItem(key, JSON.stringify(sim));
}

export function deleteSimulation(teamId: string, eventId: string, id: string): void {
  const key = makeKey(teamId, eventId, id);
  localStorage.removeItem(key);
}

export default { listSimulations, saveSimulation, deleteSimulation };
