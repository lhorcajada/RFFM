import React from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { getActa, getTeamMatches, getTeamsGoalSectorsComparison } from "../../../services/api";
import type { TeamsGoalSectorsComparison } from "../../../../../shared/utils/goalSectors";
import type { SectorDataRow } from "../../../../../shared/components/ui/SectorDataTable/SectorDataTable";
import type {
  SectorMatchDetail,
  SectorPopupState,
} from "../Components/GoalSectorsComparisonDialog";

type ComparisonRow = SectorDataRow;

type ComparisonSelection = {
  competitionId: string;
  groupId: string;
  team1: string;
  team2: string;
  loading: boolean;
};

type ComparisonData = {
  teamA?: TeamsGoalSectorsComparison[number];
  teamB?: TeamsGoalSectorsComparison[number];
  rows: ComparisonRow[];
  maxSectorEnd: number;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function parseGoalMinute(minute?: string | null): { main: number; total: number } | null {
  const normalized = asTrimmedString(minute);
  if (!normalized) return null;
  const match = normalized.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) return null;
  const main = Number.parseInt(match[1] ?? "0", 10);
  const added = Number.parseInt(match[2] ?? "0", 10);
  if (Number.isNaN(main) || Number.isNaN(added)) return null;
  return { main, total: main + added };
}

function resolveSectorMinute(minute: string, maxSectorEnd: number): number | null {
  const parsed = parseGoalMinute(minute);
  if (!parsed || maxSectorEnd <= 0) return null;
  const halfDuration = Math.max(1, Math.floor(maxSectorEnd / 2));
  if (parsed.main <= halfDuration && parsed.total > halfDuration) {
    return halfDuration;
  }
  return Math.min(parsed.total, maxSectorEnd);
}

function parseDateValue(raw?: unknown): Date | null {
  const value = asTrimmedString(raw);
  if (!value) return null;

  const normalized = value.replace(/\//g, "-");
  const isoCandidate = parseISO(normalized);
  if (isValid(isoCandidate)) return isoCandidate;

  const candidates = [
    parse(normalized, "dd-MM-yyyy", new Date()),
    parse(normalized, "dd-MM-yyyy HH:mm", new Date()),
    parse(normalized, "dd-MM-yyyy H:mm", new Date()),
  ];

  for (const candidate of candidates) {
    if (isValid(candidate)) return candidate;
  }

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

function formatDateLabel(raw?: unknown): string {
  const parsed = parseDateValue(raw);
  if (parsed) return format(parsed, "dd/MM/yyyy");
  return asTrimmedString(raw) || "Fecha no disponible";
}

function getGoalMinute(goal: Record<string, unknown>): string {
  return asTrimmedString(goal.minuto ?? goal.Minute ?? goal.minute ?? goal.MinuTo ?? "");
}

function getGoalPlayerName(goal: Record<string, unknown>): string {
  return asTrimmedString(
    goal.nombre_jugador ??
      goal.NombreJugador ??
      goal.playerName ??
      goal.PlayerName ??
      goal.nombre ??
      "",
  );
}

function isOwnGoal(goal: Record<string, unknown>): boolean {
  return asTrimmedString(goal.tipo_gol ?? goal.TipoGol ?? goal.goalType ?? "") === "102";
}

function extractMatchCode(match: Record<string, unknown>): string {
  return asTrimmedString(
    match.codacta ??
      match.matchRecordCode ??
      match.cod_acta ??
      match.id_acta ??
      match.idacta ??
      match.actaId ??
      match.acta_id ??
      match.acta ??
      "",
  );
}

function buildComparisonData(data: TeamsGoalSectorsComparison | null): ComparisonData {
  const teamA = data?.[0];
  const teamB = data?.[1];
  if (!teamA || !teamB) {
    return { teamA, teamB, rows: [], maxSectorEnd: 0 };
  }

  const sectorMap = new Map<string, { start: number; end: number }>();
  (teamA.sectors ?? []).forEach((sector) => {
    sectorMap.set(`${sector.startMinute}-${sector.endMinute}`, {
      start: sector.startMinute,
      end: sector.endMinute,
    });
  });
  (teamB.sectors ?? []).forEach((sector) => {
    sectorMap.set(`${sector.startMinute}-${sector.endMinute}`, {
      start: sector.startMinute,
      end: sector.endMinute,
    });
  });

  const merged = Array.from(sectorMap.values()).sort((a, b) => a.start - b.start);
  const rows = merged
    .map((sector) => {
      const teamAData = (teamA.sectors ?? []).find(
        (entry) => entry.startMinute === sector.start && entry.endMinute === sector.end,
      ) ?? {
        startMinute: sector.start,
        endMinute: sector.end,
        goalsFor: 0,
        goalsAgainst: 0,
      };
      const teamBData = (teamB.sectors ?? []).find(
        (entry) => entry.startMinute === sector.start && entry.endMinute === sector.end,
      ) ?? {
        startMinute: sector.start,
        endMinute: sector.end,
        goalsFor: 0,
        goalsAgainst: 0,
      };

      return {
        start: sector.start,
        end: sector.end,
        aGoals: teamAData.goalsFor ?? 0,
        aAgainst: teamAData.goalsAgainst ?? 0,
        bGoals: teamBData.goalsFor ?? 0,
        bAgainst: teamBData.goalsAgainst ?? 0,
      };
    })
    .filter((row) => row.aGoals || row.aAgainst || row.bGoals || row.bAgainst);

  return {
    teamA,
    teamB,
    rows,
    maxSectorEnd: rows.reduce((max, row) => Math.max(max, row.end), 0),
  };
}

export function useGoalSectorsComparison() {
  const [data, setData] = React.useState<TeamsGoalSectorsComparison | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<ComparisonSelection>({
    competitionId: "",
    groupId: "",
    team1: "",
    team2: "",
    loading: false,
  });
  const [sectorPopup, setSectorPopup] = React.useState<SectorPopupState>({
    open: false,
    loading: false,
    error: null,
    title: "",
    subtitle: "",
    matches: [],
  });
  const sectorCacheRef = React.useRef(new Map<string, SectorMatchDetail[]>());
  const requestIdRef = React.useRef(0);

  const comparison = buildComparisonData(data);

  function handleCompare(opts: {
    competitionId: string;
    groupId: string;
    team1: string;
    team2: string;
  }) {
    setLoading(true);
    setError(null);
    setData(null);
    setSectorPopup({
      open: false,
      loading: false,
      error: null,
      title: "",
      subtitle: "",
      matches: [],
    });
    sectorCacheRef.current.clear();

    getTeamsGoalSectorsComparison({
      teamCode: opts.team1,
      competitionId: opts.competitionId,
      groupId: opts.groupId,
      teamCode1: opts.team1,
      teamCode2: opts.team2,
    })
      .then((res) => {
        if (!res || !Array.isArray(res) || res.length === 0) {
          setError("No hay datos de sectores para la selección indicada.");
          return;
        }
        setData(res as TeamsGoalSectorsComparison);
      })
      .catch((e) => {
        setError(String(e));
      })
      .finally(() => setLoading(false));
  }

  async function handleGoalsAgainstClick(row: ComparisonRow, teamIndex: 0 | 1) {
    const team =
      comparison.teamA && comparison.teamB
        ? teamIndex === 0
          ? comparison.teamA
          : comparison.teamB
        : null;
    if (!team) return;

    const teamCode = asTrimmedString(team.teamCode);
    if (!teamCode) return;

    const title = `${team.teamName || team.teamCode} · ${row.start}-${row.end}' · Goles en contra`;
    const subtitle = `${selection.competitionId} · ${selection.groupId}`;
    const cacheKey = `${teamCode}|${selection.competitionId}|${selection.groupId}|${row.start}-${row.end}`;

    const cached = sectorCacheRef.current.get(cacheKey);
    if (cached) {
      setSectorPopup({
        open: true,
        loading: false,
        error: null,
        title,
        subtitle,
        matches: cached,
      });
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setSectorPopup({
      open: true,
      loading: true,
      error: null,
      title,
      subtitle,
      matches: [],
    });

    try {
      const rawMatches = await getTeamMatches(teamCode, {
        competition: selection.competitionId,
        group: selection.groupId,
      });

      const matchMap = new Map<string, unknown>();
      for (const entry of rawMatches || []) {
        const match = (entry as Record<string, unknown>)?.match ?? entry;
        const codacta = extractMatchCode(match as Record<string, unknown>);
        if (codacta && !matchMap.has(codacta)) {
          matchMap.set(codacta, match);
        }
      }

      const actaResults = await Promise.allSettled(
        Array.from(matchMap.keys()).map((codacta) =>
          getActa(codacta, {
            competicion: selection.competitionId,
            grupo: selection.groupId,
          }),
        ),
      );

      const details: SectorMatchDetail[] = [];
      for (const result of actaResults) {
        if (result.status !== "fulfilled") continue;

        const acta = result.value as Record<string, unknown>;
        const localTeamCode = asTrimmedString(acta.codigo_equipo_local);
        const awayTeamCode = asTrimmedString(acta.codigo_equipo_visitante);
        const isLocalTeam = localTeamCode === teamCode;
        const isAwayTeam = awayTeamCode === teamCode;
        if (!isLocalTeam && !isAwayTeam) continue;

        const localGoals = Array.isArray(acta.goles_equipo_local)
          ? acta.goles_equipo_local
          : [];
        const awayGoals = Array.isArray(acta.goles_equipo_visitante)
          ? acta.goles_equipo_visitante
          : [];

        const concededGoals = isLocalTeam
          ? [
              ...localGoals.filter((goal) => isOwnGoal(goal as Record<string, unknown>)),
              ...awayGoals.filter((goal) => !isOwnGoal(goal as Record<string, unknown>)),
            ]
          : [
              ...awayGoals.filter((goal) => isOwnGoal(goal as Record<string, unknown>)),
              ...localGoals.filter((goal) => !isOwnGoal(goal as Record<string, unknown>)),
            ];

        const goals = concededGoals
          .map((goal) => {
            const minute = getGoalMinute(goal as Record<string, unknown>);
            const usedMinute = resolveSectorMinute(minute, comparison.maxSectorEnd);
            if (usedMinute == null) return null;
            if (usedMinute < row.start || usedMinute > row.end) return null;
            return {
              minute,
              playerName:
                getGoalPlayerName(goal as Record<string, unknown>) ||
                (isOwnGoal(goal as Record<string, unknown>) ? "Autogol" : "Gol sin autor"),
              isOwnGoal: isOwnGoal(goal as Record<string, unknown>),
              usedMinute,
            } satisfies SectorMatchDetail["goals"][number];
          })
          .filter((goal): goal is SectorMatchDetail["goals"][number] => Boolean(goal))
          .sort((a, b) => a.usedMinute - b.usedMinute || a.minute.localeCompare(b.minute));

        if (goals.length === 0) continue;

        details.push({
          codacta: asTrimmedString(acta.codacta),
          title: `${asTrimmedString(acta.equipo_local) || "Local"} ${asTrimmedString(acta.goles_local) || "-"} - ${asTrimmedString(acta.goles_visitante) || "-"} ${asTrimmedString(acta.equipo_visitante) || "Visitante"}`,
          dateLabel: formatDateLabel(acta.fecha),
          scoreLabel: `${asTrimmedString(acta.goles_local) || "-"} - ${asTrimmedString(acta.goles_visitante) || "-"}`,
          goals,
        });
      }

      details.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel) || a.title.localeCompare(b.title));

      if (currentRequestId !== requestIdRef.current) return;

      sectorCacheRef.current.set(cacheKey, details);
      setSectorPopup({
        open: true,
        loading: false,
        error: null,
        title,
        subtitle,
        matches: details,
      });
    } catch (e) {
      if (currentRequestId !== requestIdRef.current) return;
      setSectorPopup({
        open: true,
        loading: false,
        error: String(e),
        title,
        subtitle,
        matches: [],
      });
    }
  }

  function closePopup() {
    setSectorPopup((current) => ({ ...current, open: false }));
  }

  return {
    data,
    comparison,
    loading,
    error,
    selection,
    setSelection,
    handleCompare,
    sectorPopup,
    closePopup,
    handleGoalsAgainstClick,
  };
}