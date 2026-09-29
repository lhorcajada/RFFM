import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import {
  getMatchResultNotificationPreference,
  setMatchResultNotificationPreference,
} from "../matchResultNotificationService";

const mockedGet = vi.mocked(client.get);
const mockedPut = vi.mocked(client.put);

describe("matchResultNotificationService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee la preferencia de /api/match-result-notifications/preference", async () => {
    mockedGet.mockResolvedValue({ data: { enabled: false, teamName: "CD Ejemplo A" } });

    const preference = await getMatchResultNotificationPreference();

    expect(mockedGet).toHaveBeenCalledWith("/api/match-result-notifications/preference");
    expect(preference).toEqual({ enabled: false, teamName: "CD Ejemplo A" });
  });

  it("devuelve teamName nulo cuando el usuario no tiene equipo principal", async () => {
    mockedGet.mockResolvedValue({ data: { enabled: true, teamName: null } });

    const preference = await getMatchResultNotificationPreference();

    expect(preference.teamName).toBeNull();
  });

  it("guarda la preferencia con PUT enviando enabled", async () => {
    mockedPut.mockResolvedValue({ data: undefined });

    await setMatchResultNotificationPreference(false);

    expect(mockedPut).toHaveBeenCalledWith("/api/match-result-notifications/preference", {
      enabled: false,
    });
  });
});
