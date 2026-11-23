import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPost = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  client: { post: (...args: unknown[]) => mockPost(...args) },
}));

import { coachAuthService, decodeJwtPayload } from "../authService";
import { clearAuthTrace, getAuthTrace } from "../../../../core/diagnostics/authTrace";

function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (o: unknown) =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o))))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "HS256" })}.${b64url(payload)}.sig`;
}

describe("coachAuthService — trazas y decodificación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearAuthTrace();
  });

  it("decodeJwtPayload lee payloads base64url sin padding y con caracteres no ASCII", () => {
    const token = makeJwt({ name: "Ñandú ???>>>", sub: "u1", exp: 10 });

    expect(decodeJwtPayload(token)).toMatchObject({ name: "Ñandú ???>>>", sub: "u1" });
  });

  it("isAuthenticated registra la caducidad con exp y hora del dispositivo cuando el token ha caducado", () => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem("coachAuthToken", makeJwt({ exp: now - 60, iat: now - 3600 }));

    expect(coachAuthService.isAuthenticated()).toBe(false);

    const entry = getAuthTrace().find((e) => e.event === "auth.token_expired");
    expect(entry?.data).toMatchObject({ exp: now - 60, iat: now - 3600 });
    expect(entry?.data).toHaveProperty("deviceNow");
  });

  it("logout registra el motivo recibido", () => {
    coachAuthService.logout("http_401");

    expect(getAuthTrace().some((e) => e.event === "auth.logout" && e.data?.reason === "http_401")).toBe(true);
  });

  it("login registra el desfase entre el reloj del servidor y el del dispositivo", async () => {
    const serverDate = new Date(Date.now() + 10 * 60 * 1000).toUTCString();
    mockPost.mockResolvedValue({ data: { token: "t" }, headers: { date: serverDate } });

    await coachAuthService.login("temp");

    const entry = getAuthTrace().find((e) => e.event === "login.response");
    expect(Math.abs(Number(entry?.data?.clockSkewSec) - -600)).toBeLessThan(5);
  });
});
