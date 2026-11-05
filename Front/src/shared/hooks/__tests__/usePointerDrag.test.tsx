import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePointerDrag } from "../usePointerDrag";

type Payload = { id: string };

function Harness({
  onStart,
  onDrop,
  onEnd,
  onClick,
  disabled,
  onMove,
  touchHoldMs,
}: {
  onMove?: (p: Payload, x: number, y: number) => void;
  touchHoldMs?: number;
  onStart?: (p: Payload) => void;
  onDrop?: (p: Payload, x: number, y: number) => void;
  onEnd?: (p: Payload, x: number, y: number, completed: boolean) => void;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const { bindDrag, dragging } = usePointerDrag<Payload>({ onStart, onDrop, onEnd, onMove, touchHoldMs });
  return (
    <div>
      <div data-testid="item" onClick={onClick} {...bindDrag({ id: "a" }, { disabled })}>
        <button type="button">inner</button>
      </div>
      <span data-testid="state">{dragging?.id ?? "none"}</span>
    </div>
  );
}

const down = (el: Element, x = 10, y = 10) =>
  fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: x, clientY: y });
const move = (x: number, y: number) =>
  act(() => {
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
  });
const up = (x: number, y: number) =>
  act(() => {
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: x, clientY: y, bubbles: true }));
  });

describe("usePointerDrag", () => {
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelectorAll("[data-pointer-drag-ghost]").forEach((n) => n.remove());
  });

  it("no empieza a arrastrar hasta superar el umbral de movimiento", () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    down(screen.getByTestId("item"));
    move(12, 12);
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("none");
  });

  it("al superar el umbral inicia el arrastre y al soltar entrega el punto del cursor", () => {
    const onStart = vi.fn();
    const onDrop = vi.fn();
    render(<Harness onStart={onStart} onDrop={onDrop} />);
    down(screen.getByTestId("item"));
    move(40, 50);
    expect(onStart).toHaveBeenCalledWith({ id: "a" });
    expect(screen.getByTestId("state")).toHaveTextContent("a");
    up(60, 70);
    expect(onDrop).toHaveBeenCalledWith({ id: "a" }, 60, 70);
    expect(screen.getByTestId("state")).toHaveTextContent("none");
  });

  it("notifica el fin del arrastre como completado al soltar", () => {
    const onEnd = vi.fn();
    render(<Harness onEnd={onEnd} />);
    down(screen.getByTestId("item"));
    move(40, 50);
    up(60, 70);
    expect(onEnd).toHaveBeenCalledWith({ id: "a" }, 60, 70, true);
  });

  it("Escape cancela el arrastre sin soltar", () => {
    const onDrop = vi.fn();
    const onEnd = vi.fn();
    render(<Harness onDrop={onDrop} onEnd={onEnd} />);
    down(screen.getByTestId("item"));
    move(40, 50);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDrop).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith({ id: "a" }, 40, 50, false);
    expect(screen.getByTestId("state")).toHaveTextContent("none");
  });

  it("pointercancel limpia el arrastre y no deja el estado colgado", () => {
    const onDrop = vi.fn();
    render(<Harness onDrop={onDrop} />);
    down(screen.getByTestId("item"));
    move(40, 50);
    act(() => {
      window.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true }));
    });
    expect(onDrop).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("none");
    expect(document.querySelector("[data-pointer-drag-ghost]")).toBeNull();
  });

  it("muestra un fantasma que sigue al cursor y lo retira al soltar", () => {
    render(<Harness />);
    down(screen.getByTestId("item"));
    move(40, 50);
    expect(document.querySelector("[data-pointer-drag-ghost]")).not.toBeNull();
    up(40, 50);
    expect(document.querySelector("[data-pointer-drag-ghost]")).toBeNull();
  });

  it("no inicia el arrastre si está deshabilitado", () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} disabled />);
    down(screen.getByTestId("item"));
    move(80, 80);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("ignora el arrastre iniciado sobre un control interactivo", () => {
    const onStart = vi.fn();
    render(<Harness onStart={onStart} />);
    down(screen.getByRole("button", { name: "inner" }));
    move(80, 80);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("un arrastre real no dispara el click posterior", () => {
    const onClick = vi.fn();
    render(<Harness onClick={onClick} />);
    const item = screen.getByTestId("item");
    down(item);
    move(40, 50);
    up(40, 50);
    fireEvent.click(item);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("un clic sin movimiento sí conserva el click", () => {
    const onClick = vi.fn();
    render(<Harness onClick={onClick} />);
    const item = screen.getByTestId("item");
    down(item);
    up(10, 10);
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("notifica cada movimiento mientras dura el arrastre", () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);
    down(screen.getByTestId("item"));
    move(40, 50);
    move(45, 55);
    expect(onMove).toHaveBeenLastCalledWith({ id: "a" }, 45, 55);
  });

  describe("con pulsación larga táctil", () => {
    const touchDown = (el: Element) =>
      fireEvent.pointerDown(el, { button: 0, pointerId: 1, pointerType: "touch", clientX: 10, clientY: 10 });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("mover el dedo antes de la pulsación larga cede el gesto al scroll", () => {
      vi.useFakeTimers();
      const onStart = vi.fn();
      render(<Harness onStart={onStart} touchHoldMs={250} />);
      touchDown(screen.getByTestId("item"));
      move(10, 40);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      move(10, 80);
      expect(onStart).not.toHaveBeenCalled();
    });

    it("tras la pulsación larga el movimiento inicia el arrastre", () => {
      vi.useFakeTimers();
      const onStart = vi.fn();
      render(<Harness onStart={onStart} touchHoldMs={250} />);
      touchDown(screen.getByTestId("item"));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      move(40, 50);
      expect(onStart).toHaveBeenCalledWith({ id: "a" });
    });
  });
});
