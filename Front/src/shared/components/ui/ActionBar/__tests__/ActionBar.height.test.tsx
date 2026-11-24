import React from "react";
import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActionBar from "../ActionBar";

type ObserverCallback = () => void;

let observerCallbacks: ObserverCallback[] = [];
let disconnect: ReturnType<typeof vi.fn>;
let barHeight = 0;

class FakeResizeObserver {
  constructor(callback: ObserverCallback) {
    observerCallbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    disconnect();
  }
}

function renderInScrollArea() {
  return render(
    <div data-testid="scroll-area" style={{ overflowY: "auto" }}>
      <ActionBar>
        <button type="button">Guardar</button>
      </ActionBar>
    </div>,
  );
}

describe("ActionBar", () => {
  beforeEach(() => {
    observerCallbacks = [];
    disconnect = vi.fn();
    barHeight = 52;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      () => barHeight,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("publica su altura real en el área de scroll", () => {
    renderInScrollArea();

    expect(
      screen.getByTestId("scroll-area").style.getPropertyValue("--rffm-action-bar-h"),
    ).toBe("52px");
  });

  it("actualiza la altura publicada cuando la barra cambia de tamaño", () => {
    renderInScrollArea();

    barHeight = 96;
    act(() => observerCallbacks.forEach((callback) => callback()));

    expect(
      screen.getByTestId("scroll-area").style.getPropertyValue("--rffm-action-bar-h"),
    ).toBe("96px");
  });

  it("retira la altura publicada al desmontarse", () => {
    const { unmount } = renderInScrollArea();
    const scrollArea = screen.getByTestId("scroll-area");

    unmount();

    expect(scrollArea.style.getPropertyValue("--rffm-action-bar-h")).toBe("");
    expect(disconnect).toHaveBeenCalled();
  });

  it("muestra los botones recibidos", () => {
    renderInScrollArea();

    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });
});
