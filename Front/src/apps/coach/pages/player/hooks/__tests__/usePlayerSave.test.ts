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

  it("no incluye familyMembers en el payload del PUT masivo (se gestionan por endpoints dedicados)", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockResolvedValue({ id: "tp-1" });

    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: {
          // El form ya no transporta familyMembers (viven en teamPlayer.familyMembers,
          // gestionados por FamilyMembersEdit vía createFamilyMember/deleteFamilyMember),
          // pero si algún caller heredado lo siguiera poniendo, el payload no debe incluirlo:
          // SetFamily en el backend reemplaza el array completo sin Ids estables.
          familyMembers: [{ name: "Ana", phone: "111", email: "ana@test.com", familyMemberId: 1 }],
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

    const [, payload] = (teamplayerService.updateTeamPlayer as any).mock.calls[0];
    expect(payload).not.toHaveProperty("familyMembers");
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

  it("incluye enfermedades, alergias y procedencia del jugador en el payload", async () => {
    const teamplayerService = (await import("../../../../services/teamplayerService")).default;
    (teamplayerService.updateTeamPlayer as any).mockResolvedValue({ id: "tp-1" });

    const { result } = renderHook(() =>
      usePlayerSave({
        teamPlayer: { id: "tp-1" },
        form: {
          enfermedades: "Asma",
          alergias: "Frutos secos",
          procedencia: "ADC Brunete",
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
      })
    );
  });
});
