import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { saveLiveMatchBackup, saveMatchParticipation } from "../../../../services/liveMatchService";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  return {
    ...actual,
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";
const STARTING_FORMATION = { id: "f1", name: "4-4-2" };

type Hook = { current: ReturnType<typeof useLiveMatch> };

function lineup(count: number): Record<number, string | null> {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [i, `p${i}`]));
}

function startMatch(result: Hook, slots: Record<number, string | null>) {
  act(() => {
    result.current.initMatch(slots, STARTING_FORMATION);
  });
  act(() => {
    result.current.setPendingAction("startMatch");
  });
  act(() => {
    result.current.confirmAction();
  });
}

function showOwnCard(result: Hook, playerId: string, cardType: "yellow" | "red") {
  act(() => {
    result.current.addCard(playerId, playerId, false, null, cardType);
  });
}

function onFieldIds(result: Hook): string[] {
  return Object.values(result.current.slots).filter(Boolean) as string[];
}

function renderLiveMatch() {
  return renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
}

describe("useLiveMatch - esquema actual", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("empieza con el esquema inicial", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    expect(result.current.currentFormation).toEqual(STARTING_FORMATION);
  });

  it("pasa al esquema elegido en un cambio de esquema", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    act(() => {
      result.current.changeFormation("f2", "4-3-3", lineup(11));
    });

    expect(result.current.currentFormation).toEqual({ id: "f2", name: "4-3-3" });
  });

  it("recupera el último esquema aplicado al aceptar la copia de un partido en curso", () => {
    const first = renderLiveMatch();
    startMatch(first.result, lineup(11));
    act(() => {
      first.result.current.changeFormation("f2", "4-3-3", lineup(11));
    });
    first.unmount();

    const { result } = renderLiveMatch();
    act(() => {
      result.current.initMatch(lineup(11), STARTING_FORMATION);
    });
    act(() => {
      result.current.acceptBackup();
    });

    expect(result.current.currentFormation).toEqual({ id: "f2", name: "4-3-3" });
  });

  it("con una copia antigua sin esquema actual usa el último cambio de esquema registrado", () => {
    saveLiveMatchBackup(EVENT_ID, {
      eventId: EVENT_ID,
      teamId: TEAM_ID,
      savedAt: new Date().toISOString(),
      matchPhase: "halftime",
      totalSeconds: 1800,
      half: 1,
      isHalftime: true,
      halfDuration: 45,
      slots: lineup(11),
      initialSlots: lineup(11),
      startingFormation: STARTING_FORMATION,
      playerStates: {},
      windows: [],
      goals: [],
      cards: [],
      formationChanges: [
        { id: "fc1", minute: 20, half: 1, formationId: "f3", formationName: "3-5-2", slotsAfter: lineup(11) },
      ],
      ratingSnapshots: [],
      scoreLocal: 0,
      scoreVisitor: 0,
    });

    const { result } = renderLiveMatch();
    act(() => {
      result.current.initMatch(lineup(11), STARTING_FORMATION);
    });
    act(() => {
      result.current.acceptBackup();
    });

    expect(result.current.currentFormation).toEqual({ id: "f3", name: "3-5-2" });
  });
});

describe("useLiveMatch - expulsión de un jugador propio", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("una roja directa saca al jugador del campo y deja 10 casillas ocupadas", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p5", "red");

    expect(Object.keys(result.current.slots)).toHaveLength(10);
    expect(onFieldIds(result)).toHaveLength(10);
    expect(onFieldIds(result)).not.toContain("p5");
    expect(result.current.playerStates.p5.isOnField).toBe(false);
  });

  it("aplica un esquema de 10 jugadores y lo registra en el historial de esquemas", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p5", "red");

    expect(result.current.currentFormation?.name).toBe("4-4-1");
    expect(result.current.formationChanges).toHaveLength(1);
    expect(result.current.formationChanges[0].formationName).toBe("4-4-1");
  });

  it("no consume ventana de cambios", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p5", "red");

    expect(result.current.windowsTotal).toBe(0);
    expect(result.current.windows).toHaveLength(0);
  });

  it("la primera amarilla no saca al jugador del campo", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p5", "yellow");

    expect(onFieldIds(result)).toHaveLength(11);
    expect(result.current.currentFormation).toEqual(STARTING_FORMATION);
  });

  it("la segunda amarilla expulsa al jugador y se guarda como dos amarillas", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p5", "yellow");
    showOwnCard(result, "p5", "yellow");

    expect(onFieldIds(result)).not.toContain("p5");
    expect(result.current.cards.map((c) => c.cardType)).toEqual(["yellow", "yellow"]);
  });

  it("una roja al rival no cambia el campo", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    act(() => {
      result.current.addCard(null, null, true, 4, "red");
    });

    expect(onFieldIds(result)).toHaveLength(11);
    expect(result.current.formationChanges).toHaveLength(0);
  });

  it("una segunda expulsión deja 9 jugadores con un esquema de 9", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p5", "red");
    showOwnCard(result, "p6", "red");

    expect(Object.keys(result.current.slots)).toHaveLength(9);
    expect(onFieldIds(result)).toHaveLength(9);
    expect(result.current.currentFormation?.name).toBe("4-3-1");
  });

  it("si el expulsado es el portero, otro jugador ocupa la portería", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p0", "red");

    expect(result.current.slots[0]).toBeTruthy();
    expect(result.current.slots[0]).not.toBe("p0");
    expect(new Set(onFieldIds(result)).size).toBe(10);
  });

  it("si el expulsado es un jugador de campo, el portero sigue en la portería", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));

    showOwnCard(result, "p5", "red");

    expect(result.current.slots[0]).toBe("p0");
  });

  it("un expulsado no puede volver al campo en preparar cambio", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));
    showOwnCard(result, "p5", "red");

    act(() => {
      result.current.startPrepare();
    });
    act(() => {
      result.current.movePreparePlayer("p5", null, 3);
    });

    expect(Object.values(result.current.prepareSlotsPreview)).not.toContain("p5");
  });

  it("una roja registrada con el partido terminado no recoloca a nadie", async () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));
    act(() => {
      result.current.setPendingAction("endMatch");
    });
    act(() => {
      result.current.confirmAction();
    });
    await waitFor(() => expect(result.current.hasSavedData).toBe(true));

    showOwnCard(result, "p5", "red");

    expect(Object.keys(result.current.slots)).toHaveLength(11);
    expect(result.current.cards).toHaveLength(1);
  });
});

describe("useLiveMatch - tarjeta puesta por error", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("quitar la tarjeta no mueve jugadores ni cambia el esquema", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));
    showOwnCard(result, "p5", "red");

    act(() => {
      result.current.removeCard(result.current.cards[0].id);
    });

    expect(onFieldIds(result)).toHaveLength(10);
    expect(result.current.currentFormation?.name).toBe("4-4-1");
  });

  it("rellenar una casilla vacía sin que salga nadie no consume ventana de cambios", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(11));
    showOwnCard(result, "p5", "red");
    act(() => {
      result.current.removeCard(result.current.cards[0].id);
    });
    const withHole: Record<number, string | null> = { ...lineup(11), 5: null };
    act(() => {
      result.current.changeFormation("f1", "4-4-2", withHole);
    });

    act(() => {
      result.current.startPrepare();
    });
    act(() => {
      result.current.movePreparePlayer("p5", null, 5);
    });
    act(() => {
      result.current.commitWindow({});
    });

    expect(result.current.slots[5]).toBe("p5");
    expect(result.current.playerStates.p5.isOnField).toBe(true);
    expect(result.current.windowsTotal).toBe(0);
  });
});

describe("useLiveMatch - mínimo de 7 jugadores", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(saveMatchParticipation).mockClear();
  });

  it("la expulsión que dejaría 6 jugadores queda pendiente de confirmación sin registrarse", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(7));

    showOwnCard(result, "p3", "red");

    expect(result.current.pendingMinPlayersCard?.teamPlayerId).toBe("p3");
    expect(result.current.cards).toHaveLength(0);
    expect(onFieldIds(result)).toHaveLength(7);
    expect(result.current.matchPhase).toBe("firstHalf");
  });

  it("al cancelar, el partido sigue sin la tarjeta", () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(7));
    showOwnCard(result, "p3", "red");

    act(() => {
      result.current.cancelMinPlayersEnd();
    });

    expect(result.current.pendingMinPlayersCard).toBeNull();
    expect(result.current.cards).toHaveLength(0);
    expect(result.current.matchPhase).toBe("firstHalf");
  });

  it("al confirmar, se registra la tarjeta, el partido termina y se guarda", async () => {
    const { result } = renderLiveMatch();
    startMatch(result, lineup(7));
    showOwnCard(result, "p3", "red");

    act(() => {
      result.current.confirmMinPlayersEnd();
    });

    expect(result.current.matchPhase).toBe("finished");
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.pendingMinPlayersCard).toBeNull();
    await waitFor(() => expect(saveMatchParticipation).toHaveBeenCalledTimes(1));
    expect(JSON.parse(vi.mocked(saveMatchParticipation).mock.calls[0][1].cardsJson)).toHaveLength(1);
  });
});
