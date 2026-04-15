import client from "../../../core/api/client";
import { getTeams, createTeam } from "./teamService";
import { getDemarcations } from "./demarcationService";
import type { Player as FedPlayer } from "../../federation/types/team";

export type ImportResult = {
  teamId: string;
  teamName: string;
  saved: number;
  skipped: number;
  errors: number;
};

export async function importFederationTeam(params: {
  clubId: string;
  federationTeamName: string;
  categoryId: number;
  seasonId: string;
  players: FedPlayer[];
}): Promise<ImportResult> {
  // 1. Find or create team under the given club
  let existingTeams = await getTeams(params.clubId, params.seasonId);
  let foundTeam = existingTeams.find(
    (t) =>
      t.name.trim().toLowerCase() ===
      params.federationTeamName.trim().toLowerCase()
  );

  if (!foundTeam) {
    await createTeam(params.clubId, {
      name: params.federationTeamName,
      categoryId: params.categoryId,
    });
    existingTeams = await getTeams(params.clubId, params.seasonId);
    foundTeam = existingTeams.find(
      (t) =>
        t.name.trim().toLowerCase() ===
        params.federationTeamName.trim().toLowerCase()
    );
  }

  if (!foundTeam) {
    throw new Error(
      `No se pudo crear el equipo: ${params.federationTeamName}`
    );
  }

  const teamId = foundTeam.id;
  let saved = 0;
  let skipped = 0;
  let errors = 0;

  // Build a name → ID lookup for demarcations (case-insensitive)
  const demarcationList = await getDemarcations();
  const demarcationByName = new Map<string, number>(
    demarcationList.map((d) => [d.name.trim().toLowerCase(), d.id])
  );

  // 2. Add each player sequentially to avoid flooding the API
  for (const player of params.players) {
    if (!player.name && !player.playerId) continue;

    const parts = (player.name ?? "").trim().split(/\s+/);
    const firstName = parts[0] || player.name;
    const lastName = parts.slice(1).join(" ") || undefined;
    const alias = player.name.substring(0, 50);

    const form = new FormData();
    form.append("TeamId", teamId);
    form.append("Name", firstName);
    if (lastName) form.append("LastName", lastName);
    form.append("Alias", alias);
    form.append("ClubId", params.clubId);
    if (player.jerseyNumber) form.append("Dorsal", player.jerseyNumber);
    if (player.birthYear && player.birthYear > 1900) {
      form.append("BirthDate", `${player.birthYear}-01-01`);
    }
    // Look up demarcation ID by position name and send it
    if (player.position) {
      const demarcId = demarcationByName.get(player.position.trim().toLowerCase());
      if (demarcId !== undefined) {
        form.append("DemarcationActivePositionId", String(demarcId));
      }
    }

    try {
      await client.post("/api/catalog/team/add-player", form);
      saved++;
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      if (status === 409) {
        skipped++;
      } else {
        errors++;
      }
    }
  }

  return { teamId, teamName: foundTeam.name, saved, skipped, errors };
}

export default { importFederationTeam };
