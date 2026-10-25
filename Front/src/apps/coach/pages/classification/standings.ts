import type {
  ClassificationTeam,
  ClassificationTeamMatch,
} from "../../../../shared/hooks/useClassification";

export type StandingZone = "promotion" | "playoff" | "relegation" | "neutral";

export type FormResult = "G" | "E" | "P";

export type StandingSpots = {
  promotionSpots?: number | null;
  playoffSpots?: number | null;
  relegationSpots?: number | null;
};

export type ZoneLegendItem = { zone: Exclude<StandingZone, "neutral">; label: string };

const ZONE_LABEL: Record<ZoneLegendItem["zone"], string> = {
  promotion: "Ascenso",
  playoff: "Promoción",
  relegation: "Descenso",
};

type ZoneRange = { zone: ZoneLegendItem["zone"]; from: number; to: number };

function getZoneRanges(spots: StandingSpots, totalTeams: number): ZoneRange[] {
  const promotion = spots.promotionSpots ?? 0;
  const playoff = spots.playoffSpots ?? 0;
  const relegation = spots.relegationSpots ?? 0;
  const ranges: ZoneRange[] = [];
  if (promotion > 0) ranges.push({ zone: "promotion", from: 1, to: promotion });
  if (playoff > 0) ranges.push({ zone: "playoff", from: promotion + 1, to: promotion + playoff });
  if (relegation > 0 && totalTeams > 0) {
    ranges.push({ zone: "relegation", from: Math.max(totalTeams - relegation + 1, 1), to: totalTeams });
  }
  return ranges;
}

export function getStandingZone(position: number, totalTeams: number, spots: StandingSpots): StandingZone {
  const range = getZoneRanges(spots, totalTeams).find((r) => position >= r.from && position <= r.to);
  return range?.zone ?? "neutral";
}

export function getZoneLegend(spots: StandingSpots, totalTeams: number): ZoneLegendItem[] {
  return getZoneRanges(spots, totalTeams).map(({ zone, from, to }) => ({
    zone,
    label: `${ZONE_LABEL[zone]} (${from === to ? `${from}º` : `${from}º–${to}º`})`,
  }));
}

export function formatGoalDifference(goalsFor: number, goalsAgainst: number): string {
  const difference = goalsFor - goalsAgainst;
  return difference > 0 ? `+${difference}` : String(difference);
}

export function pointsPerMatch(points: number, played: number): string {
  const ratio = played > 0 ? points / played : 0;
  return ratio.toFixed(1).replace(".", ",");
}

export function toForm(streaks: { type?: string }[] = []): FormResult[] {
  return streaks.map((s) => {
    const raw = (s?.type || "").toUpperCase();
    if (raw === "W" || raw === "G") return "G";
    if (raw === "D" || raw === "E") return "E";
    return "P";
  });
}

export function getGapText(teams: ClassificationTeam[], index: number): string {
  const current = teams[index];
  const above = teams[index - 1];
  const below = teams[index + 1];
  const parts: string[] = [];
  if (above) parts.push(`A ${above.points - current.points} del ${index}º`);
  if (below) parts.push(`+${current.points - below.points} sobre el ${index + 2}º`);
  return parts.join(" · ");
}

function matchTime(match: ClassificationTeamMatch): number {
  const time = new Date(match.date ?? "").getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getPlayedResults(
  matches: ClassificationTeamMatch[] = [],
  now: Date = new Date(),
): ClassificationTeamMatch[] {
  return matches
    .filter((m) => !m.opponent.toLowerCase().includes("descans"))
    .filter((m) => matchTime(m) <= now.getTime())
    .sort((a, b) => matchTime(b) - matchTime(a));
}
