import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConvocationMatchActionBar from "../ConvocationMatchActionBar";
import { CONVOCATION_TAB } from "../convocationMatchDetail.types";

const baseProps = {
  teamId: "team-1",
  tab: CONVOCATION_TAB.Alineacion,
  eventId: "event-1",
  printing: false,
  convocationConfirmed: false,
  onBack: vi.fn(),
  onOpenEvent: vi.fn(),
  onSaveConvocation: vi.fn(),
  onPrint: vi.fn(),
  onViewConvocation: vi.fn(),
  onOpenLiveMatch: vi.fn(),
};

describe("ConvocationMatchActionBar — botón Partido en directo", () => {
  it("abre la pantalla de partido en directo al pulsar el botón", async () => {
    const user = userEvent.setup();
    const onOpenLiveMatch = vi.fn();
    render(<ConvocationMatchActionBar {...baseProps} onOpenLiveMatch={onOpenLiveMatch} />);

    await user.click(screen.getByRole("button", { name: /partido en directo/i }));

    expect(onOpenLiveMatch).toHaveBeenCalledTimes(1);
  });

  it("no muestra el botón si no hay evento asociado", () => {
    render(<ConvocationMatchActionBar {...baseProps} eventId={null} />);

    expect(screen.queryByRole("button", { name: /partido en directo/i })).not.toBeInTheDocument();
  });
});
