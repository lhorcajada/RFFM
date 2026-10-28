// TODO: fijar la fecha real de lanzamiento de la quiniela (valor provisional).
export const QUINIELA_LAUNCH_DATE = "2026-11-01";
export const QUINIELA_NOVELTY_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function seenKey(userId: string | null, teamId: string): string {
  return `rffm.quiniela.seen.${userId ?? "anon"}.${teamId}`;
}

export function currentUserId(): string | null {
  try {
    const raw = localStorage.getItem("rffm_user");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "id" in parsed) {
      const id = (parsed as { id: unknown }).id;
      return typeof id === "string" && id ? id : null;
    }
  } catch {
    // sin almacenamiento o JSON inválido
  }
  return null;
}

function seenByUser(userId: string | null, teamId: string): boolean {
  try {
    return localStorage.getItem(seenKey(userId, teamId)) === "1";
  } catch {
    return false;
  }
}

export function markQuinielaSeen(userId: string | null, teamId: string): void {
  try {
    localStorage.setItem(seenKey(userId, teamId), "1");
  } catch {
    // sin almacenamiento: la etiqueta depende solo de la fecha
  }
}

export function isQuinielaNovelty(userId: string | null, teamId: string, now: Date = new Date()): boolean {
  const expiresAt = new Date(QUINIELA_LAUNCH_DATE).getTime() + QUINIELA_NOVELTY_DAYS * DAY_MS;
  if (now.getTime() >= expiresAt) return false;
  return !seenByUser(userId, teamId);
}
