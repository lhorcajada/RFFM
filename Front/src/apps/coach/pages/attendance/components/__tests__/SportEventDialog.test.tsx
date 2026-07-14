import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSportEventMock = vi.fn();
const updateSportEventMock = vi.fn();

vi.mock("../../../../services/sportEventService", () => ({
  default: {
    getSportEvents: vi.fn(),
    getSportEventById: vi.fn(),
    deleteSportEvent: vi.fn(),
    createSportEvent: (...args: unknown[]) => createSportEventMock(...args),
    updateSportEvent: (...args: unknown[]) => updateSportEventMock(...args),
    syncCalendarFromFederation: vi.fn(),
  },
  createSportEvent: (...args: unknown[]) => createSportEventMock(...args),
  updateSportEvent: (...args: unknown[]) => updateSportEventMock(...args),
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: () =>
      Promise.resolve([
        { id: 1, name: "Entrenamiento" },
        { id: 2, name: "Partido" },
      ]),
  },
}));

vi.mock("../../../../services/rivalService", () => ({
  default: {
    getRivals: () => Promise.resolve([]),
  },
}));

import SportEventDialog from "../SportEventDialog";

describe("SportEventDialog - recurring events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillMinimumValidForm() {
    await userEvent.type(screen.getByLabelText(/nombre/i), "Entrenamiento semanal");

    const typeSelect = screen.getByLabelText(/tipo de evento/i);
    await userEvent.click(typeSelect);
    const option = await screen.findByRole("option", { name: "Entrenamiento" });
    await userEvent.click(option);

    const dateField = screen.getByLabelText(/fecha y hora/i) as HTMLInputElement;
    await userEvent.clear(dateField);
    await userEvent.type(dateField, "2026-08-01T18:00");
  }

  it("always shows the 'is recurring' checkbox regardless of event type", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    expect(
      await screen.findByRole("checkbox", { name: /es recurrente/i })
    ).toBeInTheDocument();
  });

  it("does not show frequency/end-date fields until the checkbox is checked", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    const checkbox = await screen.findByRole("checkbox", { name: /es recurrente/i });
    expect(screen.queryByLabelText(/frecuencia/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fecha final de la recurrencia/i)).not.toBeInTheDocument();

    await userEvent.click(checkbox);

    expect(await screen.findByLabelText(/frecuencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha final de la recurrencia/i)).toBeInTheDocument();
  });

  it("submits without a recurrence block when the checkbox is unchecked", async () => {
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await fillMinimumValidForm();
    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.recurrence).toBeUndefined();
  }, 15000);

  it("includes a recurrence block with mapped frequency and endDate when checked and filled", async () => {
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await fillMinimumValidForm();

    const checkbox = await screen.findByRole("checkbox", { name: /es recurrente/i });
    await userEvent.click(checkbox);

    const frequencySelect = await screen.findByLabelText(/frecuencia/i);
    await userEvent.click(frequencySelect);
    const weeklyOption = await screen.findByRole("option", { name: /semanal/i });
    await userEvent.click(weeklyOption);

    const endDateField = screen.getByLabelText(/fecha final de la recurrencia/i);
    await userEvent.type(endDateField, "2026-08-24");

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.recurrence).toEqual({ frequency: "weekly", endDate: "2026-08-24" });
  }, 15000);

  it("shows a client-side validation error when the recurrence end date is not after the event date", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await fillMinimumValidForm();

    const checkbox = await screen.findByRole("checkbox", { name: /es recurrente/i });
    await userEvent.click(checkbox);

    const frequencySelect = await screen.findByLabelText(/frecuencia/i);
    await userEvent.click(frequencySelect);
    const weeklyOption = await screen.findByRole("option", { name: /semanal/i });
    await userEvent.click(weeklyOption);

    const endDateField = screen.getByLabelText(/fecha final de la recurrencia/i);
    await userEvent.type(endDateField, "2026-08-01");

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    expect(
      await screen.findByText(/la fecha final de la recurrencia debe ser posterior/i)
    ).toBeInTheDocument();
    expect(createSportEventMock).not.toHaveBeenCalled();
  }, 15000);

  it("shows the backend validation error when the recurrence would exceed the instance cap", async () => {
    createSportEventMock.mockRejectedValue({
      response: {
        data: {
          detail:
            "Una serie recurrente no puede generar más de 52 eventos; acorta la fecha final o cambia la frecuencia",
        },
      },
    });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await fillMinimumValidForm();

    const checkbox = await screen.findByRole("checkbox", { name: /es recurrente/i });
    await userEvent.click(checkbox);

    const frequencySelect = await screen.findByLabelText(/frecuencia/i);
    await userEvent.click(frequencySelect);
    const dailyOption = await screen.findByRole("option", { name: /diaria/i });
    await userEvent.click(dailyOption);

    const endDateField = screen.getByLabelText(/fecha final de la recurrencia/i);
    await userEvent.type(endDateField, "2027-08-01");

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    expect(
      await screen.findByText(/no puede generar más de 52 eventos/i)
    ).toBeInTheDocument();
  }, 15000);
});
