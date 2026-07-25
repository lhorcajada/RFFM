import type React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useTacticalBoard } from "../useTacticalBoard";
import teamplayerService from "../../../../../services/teamplayerService";

vi.mock("../../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
}));

function makePitchElement() {
  const div = document.createElement("div");
  div.style.setProperty("--touchline-band", "8");
  div.style.setProperty("--goal-back-band", "10");
  document.body.appendChild(div);
  vi.spyOn(div, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return div;
}

function makeDropEvent(data: Record<string, string>, clientX: number, clientY: number) {
  return {
    preventDefault: () => {},
    clientX,
    clientY,
    dataTransfer: { getData: (key: string) => data[key] ?? "" },
  } as unknown as React.DragEvent<HTMLDivElement>;
}

function makeMouseEvent(clientX: number, clientY: number) {
  return {
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX,
    clientY,
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}

describe("useTacticalBoard - placeChapaAtClientPoint", () => {
  beforeEach(() => {
    vi.mocked(teamplayerService.getPlayersByTeam).mockReset();
    vi.mocked(teamplayerService.getPlayersByTeam).mockResolvedValue([]);
  });

  it("preserves scale/rotation/locked when repositioning an already resized chapa", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    // 1) Place a new chapa on the board (first drop from the roster).
    act(() => {
      result.current.handleFieldDrop(
        makeDropEvent({ "text/chapa-player-id": "p1" }, 20, 30),
      );
    });

    expect(result.current.placedChapas["p1"]).toMatchObject({
      x: 20,
      y: 30,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      locked: false,
    });

    // 2) Resize the chapa (mimics handleChapaResizeStart + drag, which correctly
    // preserves the rest of the ChapaPosition while updating scale/x/y).
    act(() => {
      result.current.handleChapaResizeStart(makeMouseEvent(20, 30), "p1", "se");
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 40, clientY: 50 }));
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    const resized = result.current.placedChapas["p1"];
    expect(resized.scaleX).not.toBe(1);
    expect(resized.scaleY).not.toBe(1);

    // 3) Reposition the same chapa (drag it to a new spot on the board).
    act(() => {
      result.current.handleFieldDrop(
        makeDropEvent({ "text/chapa-player-id": "p1" }, 60, 65),
      );
    });

    const moved = result.current.placedChapas["p1"];
    expect(moved.x).toBe(60);
    expect(moved.y).toBe(65);
    expect(moved.scaleX).toBe(resized.scaleX);
    expect(moved.scaleY).toBe(resized.scaleY);
    expect(moved.rotation).toBe(resized.rotation);
    expect(moved.locked).toBe(resized.locked);
  });

  it("places a brand new chapa with default scale/rotation/locked values", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.handleFieldDrop(
        makeDropEvent({ "text/chapa-player-id": "p2" }, 15, 25),
      );
    });

    expect(result.current.placedChapas["p2"]).toEqual({
      x: 15,
      y: 25,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      locked: false,
      anonymous: false,
    });
  });
});

describe("useTacticalBoard - texts", () => {
  beforeEach(() => {
    vi.mocked(teamplayerService.getPlayersByTeam).mockReset();
    vi.mocked(teamplayerService.getPlayersByTeam).mockResolvedValue([]);
  });

  it("creates text at point with active style and enters editing mode", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    expect(result.current.placedTexts).toHaveLength(1);
    const text = result.current.placedTexts[0];
    expect(text.text).toBe("Texto");
    expect(text.x).toBe(20);
    expect(text.y).toBe(30);
    expect(text.rotation).toBe(0);
    expect(text.scaleX).toBe(1);
    expect(text.scaleY).toBe(1);
    expect(text.locked).toBe(false);
    expect(text.fontFamily).toBe(result.current.activeTextStyle.fontFamily);
    expect(text.fontSize).toBe(result.current.activeTextStyle.fontSize);
    expect(text.bold).toBe(result.current.activeTextStyle.bold);
    expect(text.italic).toBe(result.current.activeTextStyle.italic);
    expect(text.color).toBe(result.current.activeTextStyle.color);
    expect(result.current.editingTextId).toBe(text.id);
  });

  it("updates placed text content", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;

    act(() => {
      result.current.updatePlacedText(textId, { text: "Presión alta" });
    });

    expect(result.current.placedTexts[0].text).toBe("Presión alta");
  });

  it("updates placed text style", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;

    act(() => {
      result.current.updatePlacedText(textId, { bold: true, color: "#ff0000" });
    });

    expect(result.current.placedTexts[0].bold).toBe(true);
    expect(result.current.placedTexts[0].color).toBe("#ff0000");
  });

  it("removes placed text", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;

    act(() => {
      result.current.removePlacedText(textId);
    });

    expect(result.current.placedTexts).toHaveLength(0);
  });

  it("duplicates placed text with offset", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;
    const origText = result.current.placedTexts[0];

    act(() => {
      result.current.duplicatePlacedText(textId);
    });

    expect(result.current.placedTexts).toHaveLength(2);
    const duplicate = result.current.placedTexts[1];
    expect(duplicate.id).not.toBe(textId);
    expect(duplicate.x).toBe(origText.x + 2);
    expect(duplicate.y).toBe(origText.y + 2);
    expect(duplicate.text).toBe(origText.text);
    expect(duplicate.fontFamily).toBe(origText.fontFamily);
  });

  it("toggles lock on placed text", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;

    act(() => {
      result.current.toggleLockPlacedText(textId);
    });

    expect(result.current.placedTexts[0].locked).toBe(true);

    act(() => {
      result.current.toggleLockPlacedText(textId);
    });

    expect(result.current.placedTexts[0].locked).toBe(false);
  });

  it("rotates placed text by 15 degrees", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;

    act(() => {
      result.current.rotatePlacedText(textId);
    });

    expect(result.current.placedTexts[0].rotation).toBe(15);

    act(() => {
      result.current.rotatePlacedText(textId);
    });

    expect(result.current.placedTexts[0].rotation).toBe(30);

    // Rotate 23 more times to return to 0 (360 degrees total: 2 + 23 = 25 * 15 = 375, which wraps to 15... wait)
    // Actually: 360 / 15 = 24 rotations. We already did 2, so 24 - 2 = 22 more.
    for (let i = 0; i < 22; i++) {
      act(() => {
        result.current.rotatePlacedText(textId);
      });
    }

    expect(result.current.placedTexts[0].rotation).toBe(0);
  });

  it("locked text does not move when dragged", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;

    act(() => {
      result.current.toggleLockPlacedText(textId);
    });

    const origX = result.current.placedTexts[0].x;
    const origY = result.current.placedTexts[0].y;

    act(() => {
      result.current.movePlacedText(textId, 50, 60);
    });

    expect(result.current.placedTexts[0].x).toBe(origX);
    expect(result.current.placedTexts[0].y).toBe(origY);
  });

  it("sets active text style for future texts", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.setActiveTextStyle({ ...result.current.activeTextStyle, bold: true, color: "#ff0000" });
    });

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const newText = result.current.placedTexts[0];
    expect(newText.bold).toBe(true);
    expect(newText.color).toBe("#ff0000");
  });

  it("serializes and deserializes board state with texts", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.createTextAtPoint(20, 30);
    });

    const textId = result.current.placedTexts[0].id;

    act(() => {
      result.current.updatePlacedText(textId, { text: "Test", bold: true });
    });

    let json: string;
    act(() => {
      json = result.current.serializeBoardStateJson();
    });

    const origState = { ...result.current.placedTexts[0] };

    act(() => {
      result.current.clearBoardState();
    });

    expect(result.current.placedTexts).toHaveLength(0);

    act(() => {
      result.current.loadBoardStateJson(json);
    });

    expect(result.current.placedTexts).toHaveLength(1);
    expect(result.current.placedTexts[0]).toEqual(origState);
  });

  it("loads empty texts array when snapshot has no placedTexts", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.loadBoardStateJson(
        JSON.stringify({
          placedChapas: {},
          chapaPetoById: {},
          placedSpaces: [],
          placedMaterials: [],
          placedLines: [],
        }),
      );
    });

    expect(result.current.placedTexts).toEqual([]);
  });

  it("handleToggleTexts activates texts and deactivates other modes", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.handleToggleMaterials();
    });

    expect(result.current.showMaterials).toBe(true);
    expect(result.current.showTexts).toBe(false);

    act(() => {
      result.current.handleToggleTexts();
    });

    expect(result.current.showTexts).toBe(true);
    expect(result.current.showMaterials).toBe(false);
    expect(result.current.showChapas).toBe(false);
    expect(result.current.showSpaces).toBe(false);
    expect(result.current.showLines).toBe(false);
  });

  it("handleToggleLines deactivates texts when activating lines", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      result.current.handleToggleTexts();
    });

    expect(result.current.showTexts).toBe(true);

    act(() => {
      result.current.handleToggleLines();
    });

    expect(result.current.showLines).toBe(true);
    expect(result.current.showTexts).toBe(false);
  });
});
