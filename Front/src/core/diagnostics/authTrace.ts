export const AUTH_TRACE_KEY = "rffm.auth_trace";
export const MAX_TRACE_ENTRIES = 100;

export type AuthTraceEntry = {
  at: string;
  event: string;
  data?: Record<string, unknown>;
};

let memoryTrace: AuthTraceEntry[] = [];

function readStored(): AuthTraceEntry[] | null {
  try {
    const raw = localStorage.getItem(AUTH_TRACE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthTraceEntry[]) : [];
  } catch {
    return null;
  }
}

export function getAuthTrace(): AuthTraceEntry[] {
  const stored = readStored();
  if (!stored) return memoryTrace;
  return memoryTrace.length > stored.length ? memoryTrace : stored;
}

export function traceAuth(event: string, data?: Record<string, unknown>) {
  try {
    const entry: AuthTraceEntry = { at: new Date().toISOString(), event, data };
    const current = getAuthTrace();
    const next = [...current, entry].slice(-MAX_TRACE_ENTRIES);
    memoryTrace = next;
    try {
      localStorage.setItem(AUTH_TRACE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable (e.g. blocked by the browser): keep it in memory only
    }
  } catch {
    // tracing must never break the app
  }
}

export function clearAuthTrace() {
  memoryTrace = [];
  try {
    localStorage.removeItem(AUTH_TRACE_KEY);
  } catch {
    // ignore
  }
}

export function getClientInfo(): Record<string, unknown> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const loc = typeof window !== "undefined" ? window.location : undefined;
  return {
    userAgent: nav?.userAgent,
    standalone: (nav as unknown as { standalone?: boolean } | undefined)?.standalone,
    cookiesEnabled: nav?.cookieEnabled,
    online: nav?.onLine,
    url: loc ? `${loc.pathname}${loc.search}` : undefined,
    now: new Date().toISOString(),
    tzOffsetMin: new Date().getTimezoneOffset(),
  };
}

export function formatAuthTrace(): string {
  const lines = getAuthTrace().map(
    (e) => `${e.at} ${e.event}${e.data ? ` ${JSON.stringify(e.data)}` : ""}`,
  );
  return [`# ${JSON.stringify(getClientInfo())}`, ...lines].join("\n");
}
