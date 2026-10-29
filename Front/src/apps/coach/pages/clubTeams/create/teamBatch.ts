import type { TeamResponse } from "../../../services/teamService";

export const LETTERS: string[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function buildTeamName(categoryName: string, letter: string): string {
  return `${categoryName} ${letter}`;
}

export function getExistingLetters(
  teams: TeamResponse[],
  categoryId: number,
  categoryName: string
): string[] {
  const prefix = `${categoryName.trim().toLowerCase()} `;
  return LETTERS.filter((letter) =>
    teams.some(
      (t) =>
        t.category?.id === categoryId &&
        t.name.trim().toLowerCase() === `${prefix}${letter.toLowerCase()}`
    )
  );
}

export function lettersRange(count: number, existing: string[]): string[] {
  return LETTERS.slice(0, count).filter((l) => !existing.includes(l));
}
