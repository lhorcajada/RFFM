import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConvocationMatchActionBar from "../ConvocationMatchActionBar";
import { CONVOCATION_TAB } from "../convocationMatchDetail.types";

const baseProps = {
  teamId: "team-1",
  tab: CONVOCATION_TAB.Convocatoria,
  eventId: "event-1",
  printing: false,
  convocationConfirmed: false,
  onBack: vi.fn(),
  onOpenEvent: vi.fn(),
  onSaveConvocation: vi.fn(),
  onPrint: vi.fn(),
  onViewConvocation: vi.fn(),
};

describe("ConvocationMatchActionBar — publicar convocatoria", () => {
  it("muestra Publicar convocatoria y lo dispara al pulsarlo", async () => {
    const onPublishConvocation = vi.fn();
    render(<ConvocationMatchActionBar {...baseProps} onPublishConvocation={onPublishConvocation} />);

    await userEvent.click(screen.getByRole("button", { name: /publicar convocatoria/i }));

    expect(onPublishConvocation).toHaveBeenCalledTimes(1);
  });

  it("no muestra Publicar convocatoria cuando no hay nada que publicar", () => {
    render(<ConvocationMatchActionBar {...baseProps} />);

    expect(screen.queryByRole("button", { name: /publicar convocatoria/i })).not.toBeInTheDocument();
  });

  it("no muestra Publicar convocatoria en solo lectura", () => {
    render(<ConvocationMatchActionBar {...baseProps} readOnly onPublishConvocation={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /publicar convocatoria/i })).not.toBeInTheDocument();
  });
});
