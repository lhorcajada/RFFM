import type { QuinielaPaymentStatus } from "../../services/quinielaService";

const MADRID_TZ = "Europe/Madrid";

const GOAL_LABELS = ["0", "1", "2", "M"] as const;
export const PLENO_GOAL_OPTIONS = GOAL_LABELS;

export function goalsToLabel(goals: number): string {
  return GOAL_LABELS[Math.min(Math.max(goals, 0), 3)];
}

export function goalsFromLabel(label: string): number {
  const index = GOAL_LABELS.indexOf(label as (typeof GOAL_LABELS)[number]);
  return index < 0 ? 0 : index;
}

export function signOfGoals(homeGoals: number, awayGoals: number): "1" | "X" | "2" {
  if (homeGoals > awayGoals) return "1";
  return homeGoals === awayGoals ? "X" : "2";
}

function parseUtc(value: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Sáb 31 oct · 10:00» en hora de Madrid. */
export function formatKickoff(value: string | null | undefined): string {
  if (!value) return "Sin horario";
  const date = parseUtc(value);
  const day = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID_TZ, weekday: "short", day: "numeric", month: "short" })
    .format(date)
    .replace(/\./g, "")
    .replace(",", "");
  const time = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${capitalize(day)} · ${time}`;
}

export function formatMoney(value: number | null | undefined): string {
  const amount = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(value ?? 0);
  return `${amount} €`;
}

const PAYMENT_LABELS: Record<QuinielaPaymentStatus, string> = {
  Pending: "Pendiente de pago",
  Paid: "Pagado",
  Expired: "Expirado",
};

export function paymentStatusLabel(status: QuinielaPaymentStatus): string {
  return PAYMENT_LABELS[status];
}

const CATEGORY_LABELS: Record<string, string> = {
  Special: "Categoría Especial",
  First: "1ª categoría",
  Second: "2ª categoría",
  Third: "3ª categoría",
};

export function categoryLabel(category: string | null | undefined): string | null {
  return category ? (CATEGORY_LABELS[category] ?? null) : null;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

const ROLE_LABELS: Record<string, string> = {
  Coach: "Entrenador",
  Player: "Jugador",
  FamilyPlayer: "Familiar",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function paymentMethodLabel(method: string | null | undefined): string | null {
  if (method === "Cash") return "Efectivo";
  if (method === "Bizum") return "Bizum";
  return null;
}

export function signedMoney(value: number): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign}${formatMoney(Math.abs(value))}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** «Nombre · Boleto 2»: el número solo se muestra a partir del segundo boleto. */
export function ticketOwnerLabel(userName: string, ticketNumber: number): string {
  return ticketNumber > 1 ? `${userName} · Boleto ${ticketNumber}` : userName;
}
