import { step, renderSettledHook, waitForAsync } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { saveMatchParticipation } from "../../../../services/liveMatchService";
import { getFakeLiveMatchServer, resetFakeLiveMatchServer } from "./fakeLiveMatchServer";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  const fake = await import("./fakeLiveMatchServer");
  return {
    ...actual,
    ...fake.liveMatchServiceMocks(),
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";
const STARTING_FORMATION = { id: "f1", name: "4-4-2" };
const BACKUP_KEY = `rffm_live:${EVENT_ID}`;

type Hook = { current: ReturnType<typeof useLiveMatch> };

function lineup(count: number): Record<number, string | null> {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [i, `p${i}`]));
}

async function startMatch(result: Hook, slots: Record<number, string | null>) {
  await step(() => {
    result.current.initMatch(slots, STARTING_FORMATION);
  });
  await step(() => {
    result.current.setPendingAction("startMatch");
  });
  await step(() => {
    result.current.confirmAction();
  });
}

async function endMatchThroughHalves(result: Hook) {
  await step(() => result.current.setPendingAction("endFirstHalf"));
  await step(() => result.current.confirmAction());
  await step(() => result.current.setPendingAction("startSecondHalf"));
  await step(() => result.current.confirmAction());
  await step(() => result.current.setPendingAction("endMatch"));
  await step(() => result.current.confirmAction());
}

async function showOwnCard(result: Hook, playerId: string, cardType: "yellow" | "red") {
  await step(() => {
    result.current.addCard(playerId, playerId, false, null, cardType);
  });
}

function onFieldIds(result: Hook): string[] {
  return Object.values(result.current.slots).filter(Boolean) as string[];
}

async function renderLiveMatch() {
  return await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
}

describe("useLiveMatch - esquema actual", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
  });

  it("empieza con el esquema inicial", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    expect(result.current.currentFormation).toEqual(STARTING_FORMATION);
  });

  it("pasa al esquema elegido en un cambio de esquema", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await step(() => {
      result.current.changeFormation("f2", "4-3-3", lineup(11));
    });

    expect(result.current.currentFormation).toEqual({ id: "f2", name: "4-3-3" });
  });

  it("recupera desde el servidor el último esquema aplicado al volver a la pantalla", async () => {
    const first = await renderLiveMatch();
    await startMatch(first.result, lineup(11));
    await step(() => {
      first.result.current.changeFormation("f2", "4-3-3", lineup(11));
    });
    first.unmount();

    const { result } = await renderLiveMatch();

    await waitForAsync(() => expect(result.current.currentFormation).toEqual({ id: "f2", name: "4-3-3" }));
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });

  it("con una copia local heredada y sin estado en el servidor la elimina y no recupera nada", async () => {
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({
        eventId: EVENT_ID,
        teamId: TEAM_ID,
        savedAt: new Date().toISOString(),
        matchPhase: "halftime",
        formationChanges: [
          { id: "fc1", minute: 20, half: 1, formationId: "f3", formationName: "3-5-2", slotsAfter: lineup(11) },
        ],
      }),
    );

    const { result } = await renderLiveMatch();
    await waitForAsync(() => expect(localStorage.getItem(BACKUP_KEY)).toBeNull());

    expect(result.current.matchPhase).toBe("preMatch");
    expect(result.current.currentFormation).toBeNull();
  });
});

describe("useLiveMatch - expulsión de un jugador propio", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
  });

  it("una roja directa saca al jugador del campo y deja 10 casillas ocupadas", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p5", "red");

    expect(Object.keys(result.current.slots)).toHaveLength(10);
    expect(onFieldIds(result)).toHaveLength(10);
    expect(onFieldIds(result)).not.toContain("p5");
    expect(result.current.playerStates.p5.isOnField).toBe(false);
  });

  it("aplica un esquema de 10 jugadores y lo registra en el historial de esquemas", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p5", "red");

    expect(result.current.currentFormation?.name).toBe("4-4-1");
    expect(result.current.formationChanges).toHaveLength(1);
    expect(result.current.formationChanges[0].formationName).toBe("4-4-1");
  });

  it("no consume ventana de cambios", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p5", "red");

    expect(result.current.windowsTotal).toBe(0);
    expect(result.current.windows).toHaveLength(0);
  });

  it("la primera amarilla no saca al jugador del campo", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p5", "yellow");

    expect(onFieldIds(result)).toHaveLength(11);
    expect(result.current.currentFormation).toEqual(STARTING_FORMATION);
  });

  it("la segunda amarilla expulsa al jugador y se guarda como dos amarillas", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p5", "yellow");
    await showOwnCard(result, "p5", "yellow");

    expect(onFieldIds(result)).not.toContain("p5");
    expect(result.current.cards.map((c) => c.cardType)).toEqual(["yellow", "yellow"]);
  });

  it("una roja al rival no cambia el campo", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await step(() => {
      result.current.addCard(null, null, true, 4, "red");
    });

    expect(onFieldIds(result)).toHaveLength(11);
    expect(result.current.formationChanges).toHaveLength(0);
  });

  it("una segunda expulsión deja 9 jugadores con un esquema de 9", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p5", "red");
    await showOwnCard(result, "p6", "red");

    expect(Object.keys(result.current.slots)).toHaveLength(9);
    expect(onFieldIds(result)).toHaveLength(9);
    expect(result.current.currentFormation?.name).toBe("4-3-1");
  });

  it("si el expulsado es el portero, otro jugador ocupa la portería", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p0", "red");

    expect(result.current.slots[0]).toBeTruthy();
    expect(result.current.slots[0]).not.toBe("p0");
    expect(new Set(onFieldIds(result)).size).toBe(10);
  });

  it("si el expulsado es un jugador de campo, el portero sigue en la portería", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));

    await showOwnCard(result, "p5", "red");

    expect(result.current.slots[0]).toBe("p0");
  });

  it("un expulsado no puede volver al campo en preparar cambio", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));
    await showOwnCard(result, "p5", "red");

    await step(() => {
      result.current.startPrepare();
    });
    await step(() => {
      result.current.movePreparePlayer("p5", null, 3);
    });

    expect(Object.values(result.current.prepareSlotsPreview)).not.toContain("p5");
  });

  it("una roja registrada con el partido terminado no recoloca a nadie", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));
    await endMatchThroughHalves(result);
    await waitForAsync(() => expect(result.current.hasSavedData).toBe(true));

    await showOwnCard(result, "p5", "red");

    expect(Object.keys(result.current.slots)).toHaveLength(11);
    expect(result.current.cards).toHaveLength(1);
  });
});

describe("useLiveMatch - tarjeta puesta por error", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
  });

  it("quitar la tarjeta no mueve jugadores ni cambia el esquema", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));
    await showOwnCard(result, "p5", "red");

    await step(() => {
      result.current.removeCard(result.current.cards[0].id);
    });

    expect(onFieldIds(result)).toHaveLength(10);
    expect(result.current.currentFormation?.name).toBe("4-4-1");
  });

  it("rellenar una casilla vacía sin que salga nadie no consume ventana de cambios", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(11));
    await showOwnCard(result, "p5", "red");
    await step(() => {
      result.current.removeCard(result.current.cards[0].id);
    });
    const withHole: Record<number, string | null> = { ...lineup(11), 5: null };
    await step(() => {
      result.current.changeFormation("f1", "4-4-2", withHole);
    });

    await step(() => {
      result.current.startPrepare();
    });
    await step(() => {
      result.current.movePreparePlayer("p5", null, 5);
    });
    await step(() => {
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
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
    vi.mocked(saveMatchParticipation).mockClear();
  });

  it("la expulsión que dejaría 6 jugadores queda pendiente de confirmación sin registrarse", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(7));

    await showOwnCard(result, "p3", "red");

    expect(result.current.pendingMinPlayersCard?.teamPlayerId).toBe("p3");
    expect(result.current.cards).toHaveLength(0);
    expect(onFieldIds(result)).toHaveLength(7);
    expect(result.current.matchPhase).toBe("firstHalf");
  });

  it("al cancelar, el partido sigue sin la tarjeta", async () => {
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(7));
    await showOwnCard(result, "p3", "red");

    await step(() => {
      result.current.cancelMinPlayersEnd();
    });

    expect(result.current.pendingMinPlayersCard).toBeNull();
    expect(result.current.cards).toHaveLength(0);
    expect(result.current.matchPhase).toBe("firstHalf");
  });

  it("al confirmar, se registra la tarjeta, el partido termina y se cierra en el servidor", async () => {
    const server = getFakeLiveMatchServer();
    const { result } = await renderLiveMatch();
    await startMatch(result, lineup(7));
    await showOwnCard(result, "p3", "red");

    await step(() => {
      result.current.confirmMinPlayersEnd();
    });

    expect(result.current.matchPhase).toBe("finished");
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.pendingMinPlayersCard).toBeNull();
    await waitForAsync(() => expect(server.finishLiveMatch).toHaveBeenCalledTimes(1));
    expect(saveMatchParticipation).not.toHaveBeenCalled();
    expect(JSON.parse(server.state?.matchData.cardsJson ?? "[]")).toHaveLength(1);
  });
});
