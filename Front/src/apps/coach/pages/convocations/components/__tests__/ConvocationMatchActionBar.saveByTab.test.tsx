import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConvocationMatchActionBar from "../ConvocationMatchActionBar";
import { CONVOCATION_TAB } from "../convocationMatchDetail.types";

const onSaveConvocation = vi.fn();

const baseProps = {
  teamId: "team-1",
  eventId: "event-1",
  printing: false,
  convocationConfirmed: false,
  onBack: vi.fn(),
  onOpenEvent: vi.fn(),
  onSaveConvocation,
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
  });

  it("no muestra Guardar en Desconvocatorias — la alineación se guarda en su propia pantalla", () => {
    render(<ConvocationMatchActionBar {...baseProps} tab={CONVOCATION_TAB.Desconvocatorias} />);

    expect(screen.queryByRole("button", { name: /^guardar$/i })).not.toBeInTheDocument();
  });
});
