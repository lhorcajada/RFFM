import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import i18next from "../../../../../../shared/i18n/i18n";
import { usePlayerSave } from "../usePlayerSave";

vi.mock("../../../../services/teamplayerService", () => ({
  default: { updateTeamPlayer: vi.fn() },
  updateTeamPlayer: vi.fn(),
}));

describe("usePlayerSave — manejo de errores del guardado", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18next.changeLanguage("es");
  });

  it("muestra el mensaje traducido cuando el guardado falla con un error de negocio (403 + code)", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockRejectedValue({
      response: { status: 403, data: { code: "TeamPlayerEditForbidden" } },
    });

    const notify = vi.fn();
    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: {},
        demarcationOptions: [],
        setTeamPlayer: vi.fn(),
        setEditing: vi.fn(),
        notify,
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(notify).toHaveBeenCalledWith(
      i18next.t("errors:TeamPlayerEditForbidden"),
      "error"
    );
  });

  it("muestra el mensaje genérico de servidor cuando el guardado falla con un error 500", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockRejectedValue({
      response: { status: 500 },
    });

    const notify = vi.fn();
    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: {},
        demarcationOptions: [],
        setTeamPlayer: vi.fn(),
        setEditing: vi.fn(),
        notify,
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(notify).toHaveBeenCalledWith(i18next.t("errors:ServerError"), "error");
  });

  it("incluye familyMembers en el payload enviado al servicio", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockResolvedValue({ id: "tp-1" });

    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: {
          familyMembers: [
            { name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 },
          ],
        },
        demarcationOptions: [],
        setTeamPlayer: vi.fn(),
        setEditing: vi.fn(),
        notify: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(teamplayerService.updateTeamPlayer).toHaveBeenCalledWith(
      "tp-1",
      expect.objectContaining({
        familyMembers: [
          expect.objectContaining({
            name: "Ana",
            phone: "111",
            email: "ana@test.com",
            familyMemberId: 1,
          }),
        ],
      })
    );
  });

  it("incluye la dirección de contacto (calle, ciudad, código postal) en el payload", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockResolvedValue({ id: "tp-1" });

    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: { street: "Calle Falsa 123", city: "Madrid", postalCode: "28080" },
        demarcationOptions: [],
        setTeamPlayer: vi.fn(),
        setEditing: vi.fn(),
        notify: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(teamplayerService.updateTeamPlayer).toHaveBeenCalledWith(
      "tp-1",
      expect.objectContaining({
        contactInfo: expect.objectContaining({
          address: expect.objectContaining({
            street: "Calle Falsa 123",
            city: "Madrid",
            postalCode: "28080",
          }),
        }),
      })
    );
  });

  it("incluye enfermedades, alergias y procedencia del jugador y dni del familiar en el payload", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockResolvedValue({ id: "tp-1" });

    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: {
          enfermedades: "Asma",
          alergias: "Frutos secos",
          procedencia: "ADC Brunete",
          familyMembers: [
            { name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1, dni: "52378762B" },
          ],
        },
        demarcationOptions: [],
        setTeamPlayer: vi.fn(),
        setEditing: vi.fn(),
        notify: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(teamplayerService.updateTeamPlayer).toHaveBeenCalledWith(
      "tp-1",
      expect.objectContaining({
        playerInfo: expect.objectContaining({
          enfermedades: "Asma",
          alergias: "Frutos secos",
          procedencia: "ADC Brunete",
        }),
        familyMembers: [expect.objectContaining({ name: "Ana", dni: "52378762B" })],
      })
    );
  });

  it("excluye del payload las filas de familiar añadidas y dejadas completamente vacías", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockResolvedValue({ id: "tp-1" });

    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: {
          familyMembers: [
            { name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 },
            { name: "", phone: "", email: "", familyMemberId: null },
          ],
        },
        demarcationOptions: [],
        setTeamPlayer: vi.fn(),
        setEditing: vi.fn(),
        notify: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(teamplayerService.updateTeamPlayer).toHaveBeenCalledWith(
      "tp-1",
      expect.objectContaining({
        familyMembers: [expect.objectContaining({ name: "Ana" })],
      })
    );
  });
});
