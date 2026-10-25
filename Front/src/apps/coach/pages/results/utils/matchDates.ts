const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function parseLocalDate(raw: string | null | undefined): Date | null {
  const s = String(raw ?? "").trim();
  const dayFirst = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (dayFirst) return new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

export function formatMatchDay(raw: string | null | undefined): string {
  const d = parseLocalDate(raw);
  return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : "";
}

export function formatShortDay(raw: string | null | undefined): string {
  const d = parseLocalDate(raw);
  return d ? `${d.getDate()}/${d.getMonth() + 1}` : "";
}
