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
