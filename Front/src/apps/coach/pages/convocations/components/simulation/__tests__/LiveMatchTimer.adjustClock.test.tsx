import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveMatchTimer from "../LiveMatchTimer";
import type { LiveMatchPhase } from "../liveMatch.types";

function renderTimer(matchPhase: LiveMatchPhase, onAdjustClock = vi.fn()) {
  render(
    <LiveMatchTimer
      matchPhase={matchPhase}
      currentMinute={10}
      currentSecond={0}
      half={1}
      isHalftime={false}
      halfDuration={45}
      onHalfDurationChange={vi.fn()}
      pendingAction={null}
      onRequestAction={vi.fn()}
      onConfirmAction={vi.fn()}
      onCancelAction={vi.fn()}
      onAdjustClock={onAdjustClock}
    />,
  );
  return onAdjustClock;
}

describe("LiveMatchTimer - ajuste del reloj", () => {
  it("adelanta 1 y 5 minutos con los botones +1 y +5", async () => {
    const onAdjustClock = renderTimer("firstHalf");

    await userEvent.click(screen.getByRole("button", { name: /avanzar 1 minuto/i }));
    await userEvent.click(screen.getByRole("button", { name: /avanzar 5 minutos/i }));

    expect(onAdjustClock).toHaveBeenNthCalledWith(1, 1);
    expect(onAdjustClock).toHaveBeenNthCalledWith(2, 5);
  });

  it("retrasa 1 y 5 minutos con los botones -1 y -5", async () => {
    const onAdjustClock = renderTimer("secondHalf");

    await userEvent.click(screen.getByRole("button", { name: /retrasar 1 minuto/i }));
    await userEvent.click(screen.getByRole("button", { name: /retrasar 5 minutos/i }));

    expect(onAdjustClock).toHaveBeenNthCalledWith(1, -1);
    expect(onAdjustClock).toHaveBeenNthCalledWith(2, -5);
  });

  it("no muestra los botones de ajuste antes de iniciar el partido", () => {
    renderTimer("preMatch");

    expect(screen.queryByRole("button", { name: /avanzar 1 minuto/i })).not.toBeInTheDocument();
  });

  it("no muestra los botones de ajuste cuando el partido ha finalizado", () => {
    renderTimer("finished");

    expect(screen.queryByRole("button", { name: /retrasar 1 minuto/i })).not.toBeInTheDocument();
  });
});
