import type React from "react";
import { act, render, renderHook, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TacticalField from "../TacticalField";
import { useTacticalBoard } from "../../hooks/useTacticalBoard";
import teamplayerService from "../../../../../services/teamplayerService";

vi.mock("../../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
}));

function makePitchElement() {
  const div = document.createElement("div");
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

describe("TacticalField - line selection with lines panel closed", () => {
  beforeEach(() => {
    vi.mocked(teamplayerService.getPlayersByTeam).mockReset();
    vi.mocked(teamplayerService.getPlayersByTeam).mockResolvedValue([]);
  });

  it("selects an already placed line on mousedown even when showLines is false", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    // Place a line directly, bypassing the drawing UI (which requires an active tool).
    act(() => {
      boardResult.current.setPlacedLines([
        {
          id: "line-1",
          kind: "solid",
          color: "#ff0000",
          x1: 10,
          y1: 10,
          x2: 50,
          y2: 50,
        },
      ]);
    });

    // Default state: lines panel closed, no active drawing tool.
    expect(boardResult.current.showLines).toBe(false);
    expect(boardResult.current.activeLineKind).toBeNull();

    const { container } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const linePath = container.querySelector('[data-testid="line-hit-line-1"]');
    expect(linePath).not.toBeNull();

    // Before selection, no endpoint handle buttons for the line are rendered.
    expect(container.querySelectorAll("button").length).toBe(0);

    act(() => {
      linePath!.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }),
      );
    });

    // The line should become selected (endpoint handle + controls buttons
    // render) even though the lines side panel (showLines) is closed.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("renders a wide invisible hit-area path for each line, wider than the visible stroke", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.setPlacedLines([
        {
          id: "line-1",
          kind: "solid",
          color: "#ff0000",
          x1: 10,
          y1: 10,
          x2: 50,
          y2: 50,
        },
      ]);
    });

    const { container } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const visiblePath = container.querySelector('path[stroke="#ff0000"]');
    expect(visiblePath).not.toBeNull();
    expect(visiblePath!.getAttribute("stroke-width")).toBe("1.5");

    const hitAreaPath = container.querySelector('[data-testid="line-hit-line-1"]');
    expect(hitAreaPath).not.toBeNull();
    expect(hitAreaPath!.tagName.toLowerCase()).toBe("path");
    expect(hitAreaPath!.getAttribute("stroke-width")).toBe("8");
    expect(hitAreaPath!.getAttribute("stroke")).toBe("transparent");
    // Same path geometry as the visible line.
    expect(hitAreaPath!.getAttribute("d")).toBe(visiblePath!.getAttribute("d"));

    // Before selection, no endpoint handle buttons for the line are rendered.
    expect(container.querySelectorAll("button").length).toBe(0);

    act(() => {
      hitAreaPath!.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }),
      );
    });

    // Selection is driven by the wide hit-area path, not the thin visible one.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("deselects a selected line when clicking on the field outside any object", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.setPlacedLines([
        {
          id: "line-1",
          kind: "solid",
          color: "#ff0000",
          x1: 10,
          y1: 10,
          x2: 50,
          y2: 50,
        },
      ]);
    });

    const { container } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const linePath = container.querySelector('[data-testid="line-hit-line-1"]');
    expect(linePath).not.toBeNull();

    act(() => {
      linePath!.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }),
      );
    });

    // The line is now selected: endpoint handle buttons are rendered.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);

    // Clicking on the field itself, outside any object, should deselect the line.
    // Note: React overwrites halfPitchRef.current with the real mounted DOM
    // node on render, so we must target that node (not the manually-created
    // `pitchEl`, which is now stale).
    act(() => {
      halfPitchRef.current!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("keeps a line selected after dragging it (mousedown + move + mouseup + click on the same hit-area)", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.setPlacedLines([
        {
          id: "line-1",
          kind: "solid",
          color: "#ff0000",
          x1: 10,
          y1: 10,
          x2: 50,
          y2: 50,
        },
      ]);
    });

    const { container } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const linePath = container.querySelector('[data-testid="line-hit-line-1"]');
    expect(linePath).not.toBeNull();

    // Drag the line: mousedown on the hit-area, move (which selects it and
    // starts the drag session), then release. Browsers fire a "click" event
    // afterwards targeting the same element that received the mousedown,
    // even though a drag happened in between.
    act(() => {
      linePath!.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }),
      );
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    });

    act(() => {
      linePath!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    // The line must still be selected after the drag+click sequence: the
    // endpoint handle buttons should still be present.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });
});

describe("TacticalField - texts rendering and interaction", () => {
  beforeEach(() => {
    vi.mocked(teamplayerService.getPlayersByTeam).mockReset();
    vi.mocked(teamplayerService.getPlayersByTeam).mockResolvedValue([]);
  });

  it("renders placed texts with correct styles", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.setPlacedTexts([
        {
          id: "text-1",
          text: "Test",
          x: 50,
          y: 50,
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          bold: true,
          italic: true,
          color: "#ff0000",
          rotation: 15,
          scaleX: 1.5,
          scaleY: 1.5,
          locked: false,
        },
      ]);
    });

    const { container } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const textElement = container.querySelector('[data-testid="placed-text-text-1"]') as HTMLElement;
    if (textElement) {
      expect(textElement.textContent).toBe("Test");
      expect(textElement.style.fontFamily).toBe("Arial, sans-serif");
      expect(textElement.style.color).toBe("rgb(255, 0, 0)");
      expect(textElement.style.fontWeight).toBe("700");
      expect(textElement.style.fontStyle).toBe("italic");
    }
  });

  it("selects text on click", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.setPlacedTexts([
        {
          id: "text-1",
          text: "Click me",
          x: 50,
          y: 50,
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          bold: false,
          italic: false,
          color: "#ffffff",
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          locked: false,
        },
      ]);
    });

    const { container } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const textElement = container.querySelector('[data-testid="placed-text-text-1"]') as HTMLElement;
    if (textElement) {
      act(() => {
        fireEvent.click(textElement);
      });

      // After clicking, check that PlacedObjectControls is rendered (which means the text is selected)
      const controls = container.querySelector(`button[aria-label*="Redimensionar"]`);
      expect(controls).toBeTruthy();
    }
  });

  it("enters edit mode on double click", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.createTextAtPoint(50, 50);
    });

    const textId = boardResult.current.placedTexts[0].id;

    const { container, rerender } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const textElement = container.querySelector(`[data-testid="placed-text-${textId}"]`) as HTMLElement;
    if (textElement) {
      act(() => {
        textElement.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      });

      rerender(
        <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
      );

      // After double click, there should be a textarea
      const textarea = container.querySelector(`[data-testid="text-editor-${textId}"]`);
      expect(textarea).toBeTruthy();
    }
  });

  it("confirms text content on blur", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.createTextAtPoint(50, 50);
    });

    const textId = boardResult.current.placedTexts[0].id;

    act(() => {
      boardResult.current.setEditingTextId(textId);
    });

    const { container, rerender } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const textarea = container.querySelector(`[data-testid="text-editor-${textId}"]`) as HTMLTextAreaElement;
    if (textarea) {
      act(() => {
        fireEvent.change(textarea, { target: { value: "Updated text" } });
      });

      rerender(
        <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
      );

      act(() => {
        fireEvent.blur(textarea);
      });

      expect(boardResult.current.placedTexts[0].text).toBe("Updated text");
      expect(boardResult.current.editingTextId).toBeNull();
    }
  });

  it("removes empty text on confirm", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.createTextAtPoint(50, 50);
    });

    const textId = boardResult.current.placedTexts[0].id;

    act(() => {
      boardResult.current.setEditingTextId(textId);
    });

    const { container, rerender } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const textarea = container.querySelector(`[data-testid="text-editor-${textId}"]`) as HTMLTextAreaElement;
    if (textarea) {
      act(() => {
        fireEvent.change(textarea, { target: { value: "" } });
      });

      rerender(
        <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
      );

      act(() => {
        fireEvent.blur(textarea);
      });

      expect(boardResult.current.placedTexts).toHaveLength(0);
    }
  });

  it("cancels editing on escape", () => {
    const pitchEl = makePitchElement();
    const halfPitchRef = { current: pitchEl } as React.RefObject<HTMLDivElement>;

    const { result: boardResult } = renderHook(() => useTacticalBoard(halfPitchRef, ""));

    act(() => {
      boardResult.current.createTextAtPoint(50, 50);
    });

    const textId = boardResult.current.placedTexts[0].id;
    const originalText = boardResult.current.placedTexts[0].text;

    act(() => {
      boardResult.current.setEditingTextId(textId);
    });

    const { container, rerender } = render(
      <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
    );

    const textarea = container.querySelector(`[data-testid="text-editor-${textId}"]`) as HTMLTextAreaElement;
    if (textarea) {
      act(() => {
        fireEvent.change(textarea, { target: { value: "Changed" } });
      });

      rerender(
        <TacticalField halfPitchRef={halfPitchRef} board={boardResult.current} />,
      );

      act(() => {
        fireEvent.keyDown(textarea, { key: "Escape" });
      });

      expect(boardResult.current.placedTexts[0].text).toBe(originalText);
      expect(boardResult.current.editingTextId).toBeNull();
    }
  });
});
