export function resolveShield(u: string | undefined | null) {
  if (!u) return "";
  const s = String(u);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `https://www.rffm.es${s}`;
  return s;
}

export function parseTimeToHM(
  time?: string | null
): { h: number; m: number } | null {
  if (!time) return null;
  let s = String(time).trim();
  s = s.replace(/[a-zA-Z]+$/g, "").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
  const m2 = s.match(/^(\d{1,2})$/);
  if (m2) return { h: parseInt(m2[1], 10), m: 0 };
  return null;
}

export function parseGoalValue(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
