import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConvocationMatchActionBar from "../ConvocationMatchActionBar";
import { CONVOCATION_TAB } from "../convocationMatchDetail.types";

const onSaveConvocation = vi.fn();
const onSaveLineup = vi.fn();

const baseProps = {
  teamId: "team-1",
  eventId: "event-1",
  lineupPlayersCount: 1,
  printing: false,
  convocationConfirmed: false,
  onBack: vi.fn(),
  onOpenEvent: vi.fn(),
  onSaveConvocation,
  onSaveLineup,
  onPrint: vi.fn(),
  onViewConvocation: vi.fn(),
};

describe("ConvocationMatchActionBar — botón Guardar según la pestaña", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda la convocatoria desde la pestaña Convocatoria", () => {
    render(<ConvocationMatchActionBar {...baseProps} tab={CONVOCATION_TAB.Convocatoria} />);

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(onSaveConvocation).toHaveBeenCalledTimes(1);
    expect(onSaveLineup).not.toHaveBeenCalled();
  });

  it("guarda la alineación desde la pestaña Alineación", () => {
    render(<ConvocationMatchActionBar {...baseProps} tab={CONVOCATION_TAB.Alineacion} />);

    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(onSaveLineup).toHaveBeenCalledTimes(1);
    expect(onSaveConvocation).not.toHaveBeenCalled();
  });
});
