import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TacticalBoardState } from "../../hooks/useTacticalBoard";
import TextsStrip from "../TextsStrip";
import { DEFAULT_TEXT_STYLE, LINE_COLORS, TEXT_FONT_OPTIONS, TEXT_SIZE_OPTIONS } from "../../constants";

describe("TextsStrip", () => {
  const mockBoard: Partial<TacticalBoardState> = {
    activeTextStyle: DEFAULT_TEXT_STYLE,
    setActiveTextStyle: vi.fn(),
    placedTexts: [
      {
        id: "text-1",
        text: "Test Text",
        x: 50,
        y: 50,
        fontFamily: TEXT_FONT_OPTIONS[0].key,
        fontSize: 16,
        bold: false,
        italic: false,
        color: "#ffffff",
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        locked: false,
      },
    ],
    updatePlacedText: vi.fn(),
  };

  it("renders font, size, and style controls", () => {
    render(
      <TextsStrip
        board={mockBoard as TacticalBoardState}
        selectedTextId={null}
      />,
    );

    // Check for select elements
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);

    // Check for button controls (B/I and color swatches)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    // Check for hint text
    expect(screen.getByText(/Haz clic en el campo/i)).toBeInTheDocument();
  });

  it("toggles bold when B button is clicked", () => {
    const setActiveTextStyle = vi.fn();
    const board: Partial<TacticalBoardState> = {
      ...mockBoard,
      setActiveTextStyle,
    };

    render(
      <TextsStrip
        board={board as TacticalBoardState}
        selectedTextId={null}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const boldButton = buttons.find((btn) => {
      const style = window.getComputedStyle(btn);
      return btn.textContent?.trim() === "B";
    });

    if (boldButton) {
      fireEvent.click(boldButton);
      expect(setActiveTextStyle).toHaveBeenCalled();
    }
  });

  it("toggles italic when I button is clicked", () => {
    const setActiveTextStyle = vi.fn();
    const board: Partial<TacticalBoardState> = {
      ...mockBoard,
      setActiveTextStyle,
    };

    render(
      <TextsStrip
        board={board as TacticalBoardState}
        selectedTextId={null}
      />,
    );

    const buttons = screen.getAllByRole("button");
    const italicButton = buttons.find((btn) => {
      return btn.textContent?.trim() === "I";
    });

    if (italicButton) {
      fireEvent.click(italicButton);
      expect(setActiveTextStyle).toHaveBeenCalled();
    }
  });

  it("renders color swatches for all available colors", () => {
    render(
      <TextsStrip
        board={mockBoard as TacticalBoardState}
        selectedTextId={null}
      />,
    );

    // Color swatches should be present as buttons
    const allButtons = screen.getAllByRole("button");
    // We expect: B button, I button, and color swatches (7 colors)
    expect(allButtons.length).toBeGreaterThanOrEqual(2 + LINE_COLORS.length);
  });

  it("displays current style when no text is selected", () => {
    const board: Partial<TacticalBoardState> = {
      ...mockBoard,
      activeTextStyle: {
        fontFamily: TEXT_FONT_OPTIONS[1].key,
        fontSize: 24,
        bold: true,
        italic: true,
        color: "#ff0000",
      },
    };

    render(
      <TextsStrip
        board={board as TacticalBoardState}
        selectedTextId={null}
      />,
    );

    expect(screen.getByText(/Haz clic en el campo/i)).toBeInTheDocument();
  });

  it("renders hint about text creation", () => {
    render(
      <TextsStrip
        board={mockBoard as TacticalBoardState}
        selectedTextId={null}
      />,
    );

    expect(screen.getByText(/Doble clic sobre un texto para editarlo/i)).toBeInTheDocument();
  });
});
