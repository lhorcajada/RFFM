import { describe, it, expect } from "vitest";
import { isPublicAuthRoute } from "./publicRoutes";

describe("isPublicAuthRoute", () => {
  it("treats /register as public so AuthMonitor never bounces a mid-registration user to /login", () => {
    expect(isPublicAuthRoute("/register")).toBe(true);
  });

  it("treats /login, /forgot-password and /reset-password as public", () => {
    expect(isPublicAuthRoute("/login")).toBe(true);
    expect(isPublicAuthRoute("/forgot-password")).toBe(true);
    expect(isPublicAuthRoute("/reset-password")).toBe(true);
  });

  it("treats protected coach routes as non-public", () => {
    expect(isPublicAuthRoute("/coach/squad")).toBe(false);
    expect(isPublicAuthRoute("/appSelector")).toBe(false);
  });
});
