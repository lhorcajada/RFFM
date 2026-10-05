import { parseTimeToHM } from "./match";

export function parseMatchDate(raw?: string | null): Date | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\//g, "-").trim();
  const parts = s.split("-").map((p: string) => p.trim());
  if (parts.length >= 3 && parts[0].length === 2 && parts[2].length === 4) {
    s = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function weekendKey(d: Date): string | null {
  const dayOfWeek = d.getDay();
  if (dayOfWeek !== 6 && dayOfWeek !== 0) return null;
  const saturday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dayOfWeek === 0) saturday.setDate(saturday.getDate() - 1);
  return `${saturday.getFullYear()}-${saturday.getMonth()}-${saturday.getDate()}`;
}

// La jornada se juega en el fin de semana con más partidos; lo que caiga fuera está aplazado.
function findRoundWeekend(dates: Date[]): string | null {
  const counts = new Map<string, number>();
  dates.forEach((d) => {
    const key = weekendKey(d);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  let best: string | null = null;
  let bestCount = 0;
  counts.forEach((count, key) => {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  });
  return best;
}

export function groupMatchesByWeekend(matches: any[]): {
  saturday: any[];
  sunday: any[];
  postponed: any[];
  byes: any[];
} {
  const saturday: any[] = [];
  const sunday: any[] = [];
  const postponed: any[] = [];
  const byes: any[] = [];
  const pending: { item: any; d: Date | null }[] = [];

  (matches || []).forEach((m) => {
    const raw = m.fecha ?? m.date ?? m.fecha_partido ?? "";
    let d = null;
    if (raw) {
      const parsed = parseMatchDate(raw);
      if (parsed) d = parsed;
    }

    const item = { rawDate: raw, parsedDate: d, match: m };

    // Detect explicit 'descansa' team names (case-insensitive)
    const localName = String(
      m.equipo_local ?? m.local ?? m.localTeamName ?? m.nombre ?? ""
    ).trim();
    const awayName = String(
      m.equipo_visitante ?? m.visitante ?? m.awayTeamName ?? m.nombre ?? ""
    ).trim();
    const isDescansa =
      String(localName).toLowerCase() === "descansa" ||
      String(awayName).toLowerCase() === "descansa";

    if (isDescansa) {
      // Treat these as byes regardless of date/time
      byes.push(item);
      return;
    }

    pending.push({ item, d });
  });

  const roundWeekend = findRoundWeekend(
    pending.map((p) => p.d).filter((d): d is Date => d !== null)
  );

  pending.forEach(({ item, d }) => {
    const isInRoundWeekend = d !== null && weekendKey(d) === roundWeekend;
    if (!isInRoundWeekend) {
      postponed.push(item);
    } else if (d.getDay() === 6) {
      saturday.push(item);
    } else {
      sunday.push(item);
    }
  });

  return { saturday, sunday, postponed, byes };
}

export function sortMatchesByTime(a: any, b: any): number {
  const extractTime = (it: any) => {
    // try to find explicit time in rawDate (e.g. 'dd-mm-yyyy hh:mm')
    if (it && it.rawDate && typeof it.rawDate === "string") {
      const parts = it.rawDate
        .split(" ")
        .map((p: string) => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        const cand = parts[parts.length - 1];
        const t = parseTimeToHM(cand);
        if (t) return t;
      }
    }
    // try common fields
    const t1 = parseTimeToHM(
      it.match?.hora ?? it.match?.time ?? it.match?.Hora ?? null
    );
    if (t1) return t1;
    return null;
  };

  const ta = extractTime(a);
  const tb = extractTime(b);

  if (ta && tb) {
    if (ta.h !== tb.h) return ta.h - tb.h;
    return ta.m - tb.m;
  }

  const da = a.parsedDate ? a.parsedDate.getTime() : null;
  const db = b.parsedDate ? b.parsedDate.getTime() : null;
  if (da !== null && db !== null) return da - db;
  if (da !== null) return -1;
  if (db !== null) return 1;

  const ra = String(a.rawDate ?? a.match?.fecha ?? "");
  const rb = String(b.rawDate ?? b.match?.fecha ?? "");
  return ra.localeCompare(rb);
}
