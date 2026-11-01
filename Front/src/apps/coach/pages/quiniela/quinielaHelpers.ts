import type {
  QuinielaPaymentStatus,
  QuinielaTicketPaymentMethod,
  QuinielaWalletCharge,
  QuinielaWalletMovementType,
} from "../../services/quinielaService";

import { COACH_FEATURE_ROUTES } from "../../constants/featureRoutes";

const MADRID_TZ = "Europe/Madrid";

export function quinielaHistoryHref(teamId: string): string {
  return `${COACH_FEATURE_ROUTES.Quiniela}/historico?teamId=${encodeURIComponent(teamId)}`;
}

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

/** «sábado 07/11/2026» en hora de Madrid; vacío si no hay fecha. */
export function formatJornadaDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseUtc(value);
  const weekday = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID_TZ, weekday: "long" }).format(date);
  const dayMonthYear = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  return `${weekday} ${dayMonthYear}`;
}

export function formatMoney(value: number | null | undefined): string {
  const amount = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(value ?? 0);
  return `${amount} €`;
}

// Pesos de la liquidación (Especial 7,5 / 1ª 16 / 2ª 7,5 / 3ª 7,5). Duplican los del backend (QuinielaScoring).
const PRIZE_WEIGHTS = { Special: 7.5, First: 16, Second: 7.5, Third: 7.5 } as const;
const PRIZE_TOTAL_WEIGHT = 38.5;

export type PrizeCategoryKey = keyof typeof PRIZE_WEIGHTS;

/** Porcentaje de la bolsa que se lleva una categoría. */
export function prizeCategoryShare(category: PrizeCategoryKey): number {
  return (PRIZE_WEIGHTS[category] / PRIZE_TOTAL_WEIGHT) * 100;
}

/** Importe de la bolsa que corresponde a cada categoría, truncado al céntimo como la liquidación. */
export function prizeCategoryFunds(prizePool: number): Record<PrizeCategoryKey, number> {
  const fundOf = (category: PrizeCategoryKey) =>
    Math.floor((prizePool * PRIZE_WEIGHTS[category]) / PRIZE_TOTAL_WEIGHT * 100 + 1e-9) / 100;
  return { Special: fundOf("Special"), First: fundOf("First"), Second: fundOf("Second"), Third: fundOf("Third") };
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
  if (method === "Wallet") return "Monedero";
  return null;
}

export function ticketPaymentLabel(
  status: QuinielaPaymentStatus,
  method: QuinielaTicketPaymentMethod | null | undefined,
): string {
  return status === "Paid" && method === "Wallet" ? "Pagado con monedero" : paymentStatusLabel(status);
}

const WALLET_MOVEMENT_LABELS: Record<QuinielaWalletMovementType, string> = {
  TopUp: "Recarga",
  Adjustment: "Ajuste",
  TicketCharge: "Cobro de boleto",
  TicketRefund: "Reembolso de boleto",
  Prize: "Premio",
  Donation: "Donación",
};

export function walletMovementLabel(type: QuinielaWalletMovementType): string {
  return WALLET_MOVEMENT_LABELS[type] ?? type;
}

export const WALLET_MIN_AMOUNT = 0.01;
export const WALLET_MAX_AMOUNT = 10;

export function parseWalletAmount(text: string): { value: number } | { error: string } {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return { error: "Introduce un importe." };
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { error: "El importe debe ser un número con 2 decimales como máximo." };
  const value = Number(normalized);
  if (value < WALLET_MIN_AMOUNT || value > WALLET_MAX_AMOUNT) {
    return { error: `El importe debe estar entre ${formatMoney(WALLET_MIN_AMOUNT)} y ${formatMoney(WALLET_MAX_AMOUNT)}.` };
  }
  return { value };
}

export function parseDonationAmount(text: string, balance: number): { value: number } | { error: string } {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return { error: "Introduce un importe." };
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { error: "El importe debe ser un número con 2 decimales como máximo." };
  const value = Number(normalized);
  if (value < WALLET_MIN_AMOUNT) return { error: `El importe mínimo es ${formatMoney(WALLET_MIN_AMOUNT)}.` };
  if (value > balance) return { error: `El importe supera tu saldo (${formatMoney(balance)}).` };
  return { value };
}

export function walletChargeMessage(charge: QuinielaWalletCharge): string {
  return `Se han cobrado ${formatMoney(charge.amount)} de tu monedero. Saldo: ${formatMoney(charge.balanceAfter)}`;
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
