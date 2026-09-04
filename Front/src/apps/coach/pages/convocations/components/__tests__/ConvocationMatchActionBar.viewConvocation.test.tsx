import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConvocationMatchActionBar from "../ConvocationMatchActionBar";

const baseProps = {
  teamId: "team-1",
  tab: 1,
  eventId: "event-1",
  lineupPlayersCount: 0,
  printing: false,
  onBack: vi.fn(),
  onOpenEvent: vi.fn(),
  onSaveConvocation: vi.fn(),
  onSaveLineup: vi.fn(),
  onPrint: vi.fn(),
  onViewConvocation: vi.fn(),
};

describe("ConvocationMatchActionBar — botón Ver convocatoria", () => {
  it("no muestra el botón WhatsApp — se accede a copiar desde Ver convocatoria", () => {
    render(<ConvocationMatchActionBar {...baseProps} convocationConfirmed={true} />);

    expect(screen.queryByRole("button", { name: /whatsapp/i })).not.toBeInTheDocument();
  });

  it("no muestra el botón Ver convocatoria si la convocatoria no está confirmada por todos", () => {
    render(<ConvocationMatchActionBar {...baseProps} convocationConfirmed={false} />);

    expect(screen.queryByRole("button", { name: /ver convocatoria/i })).not.toBeInTheDocument();
  });

  it("muestra el botón Ver convocatoria cuando la convocatoria está confirmada por todos", () => {
    render(<ConvocationMatchActionBar {...baseProps} convocationConfirmed={true} />);

    expect(screen.getByRole("button", { name: /ver convocatoria/i })).toBeInTheDocument();
  });

  it("no muestra el botón Ver convocatoria si no hay evento asociado, aunque esté confirmada", () => {
    render(<ConvocationMatchActionBar {...baseProps} eventId={null} convocationConfirmed={true} />);

    expect(screen.queryByRole("button", { name: /ver convocatoria/i })).not.toBeInTheDocument();
  });

  it("llama a onViewConvocation al pulsar el botón", async () => {
    const user = userEvent.setup();
    const onViewConvocation = vi.fn();
    render(
      <ConvocationMatchActionBar
        {...baseProps}
        convocationConfirmed={true}
        onViewConvocation={onViewConvocation}
      />,
    );

    await user.click(screen.getByRole("button", { name: /ver convocatoria/i }));

    expect(onViewConvocation).toHaveBeenCalledTimes(1);
  });
});
