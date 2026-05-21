import type { ClubTeam } from "../../../../federation/services/Federation/ClubService";

export const CATEGORY_ORDER = [
  "Debutantes",
  "Prebenjamines",
  "Benjamines",
  "Alevines",
  "Infantiles",
  "Cadetes",
  "Juveniles",
  "Senior",
] as const;

export type CategoryKey = (typeof CATEGORY_ORDER)[number];

export type ClubTeamCard = ClubTeam & {
  categoryKey: CategoryKey | null;
  position?: number | null;
};

export type TeamGroup = {
  label: CategoryKey;
  teams: ClubTeamCard[];
};

export function normalizeCategory(description?: string | null): CategoryKey | null {
  if (!description) return null;
  const value = description
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (value.includes("debut")) return "Debutantes";
  if (value.includes("prebenjam")) return "Prebenjamines";
  if (value.includes("benjam")) return "Benjamines";
  if (value.includes("alevin")) return "Alevines";
  if (value.includes("infantil") || value.includes("intantil")) return "Infantiles";
  if (value.includes("cadet")) return "Cadetes";
  if (value.includes("juvenil")) return "Juveniles";
  if (value.includes("senior") || value.includes("aficionad")) return "Senior";
  return null;
}

export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getSearchCandidates(clubName: string): string[] {
  const normalized = clubName.trim();
  const firstToken = normalized.split(/\s+/)[0] ?? "";

  return Array.from(new Set([normalized, firstToken].filter(Boolean)));
}

export function buildGroups(teams: ClubTeamCard[], selectedCategory: CategoryKey): TeamGroup[] {
  const currentIndex = CATEGORY_ORDER.indexOf(selectedCategory);
  const previousCategory = currentIndex > 0 ? CATEGORY_ORDER[currentIndex - 1] : null;
  const groups: TeamGroup[] = [];

  if (previousCategory) {
    const previousTeams = teams.filter((team) => team.categoryKey === previousCategory);
    if (previousTeams.length > 0) {
      groups.push({ label: previousCategory, teams: previousTeams });
    }
  }

  const currentTeams = teams.filter((team) => team.categoryKey === selectedCategory);
  if (currentTeams.length > 0) {
    groups.push({ label: selectedCategory, teams: currentTeams });
  }

  return groups;
}
