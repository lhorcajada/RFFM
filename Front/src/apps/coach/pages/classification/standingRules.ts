import type { StandingSpots } from "./standings";

type Category = "CADETE" | "INFANTIL" | "ALEVIN";

const CATEGORIES: Category[] = ["CADETE", "INFANTIL", "ALEVIN"];

function spots(promotionSpots: number, relegationSpots: number | null): StandingSpots {
  return { promotionSpots, playoffSpots: 0, relegationSpots };
}

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

// Bases de Ascensos y Descensos Fútbol 11 RFFM, temporada 2026/2027 (plazas por grupo).
// Descensos "por determinar" (dependen de los ascensos de la división inferior) quedan en null.
// Aficionados, Juveniles y Femenino tienen playoffs entre grupos o descensos variables: sin regla.
function rulesFor(category: Category, division: string): StandingSpots | null {
  if (division.includes("SUPERLIGA")) return spots(0, 4);
  if (division.includes("DIVISION DE HONOR")) return spots(2, 4);
  if (division.includes("AUTONOMICA")) return spots(2, 4);
  if (division.includes("PREFERENTE")) return spots(2, category === "ALEVIN" ? null : 4);
  if (division.includes("PRIMERA")) return spots(2, category === "ALEVIN" ? 0 : null);
  if (division.includes("SEGUNDA") && category !== "ALEVIN") return spots(2, 0);
  return null;
}

export function getDefaultStandingSpots(competitionName?: string | null): StandingSpots | null {
  if (!competitionName) return null;
  const name = normalize(competitionName);
  if (name.includes("FEMENINO")) return null;
  const category = CATEGORIES.find((c) => name.includes(c));
  return category ? rulesFor(category, name) : null;
}

export function resolveStandingSpots(
  teamSpots: StandingSpots,
  competitionName?: string | null,
): StandingSpots {
  const hasTeamSpots = [teamSpots.promotionSpots, teamSpots.playoffSpots, teamSpots.relegationSpots].some(
    (value) => value !== null && value !== undefined,
  );
  if (hasTeamSpots) return teamSpots;
  return getDefaultStandingSpots(competitionName) ?? {};
}
