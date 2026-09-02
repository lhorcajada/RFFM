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

const uploadRivalPhotoMock = vi.fn();
const getRivalsMock = vi.fn(() => Promise.resolve([]));

vi.mock("../../../../services/rivalService", () => ({
  default: {
    getRivals: (...args: unknown[]) => getRivalsMock(...args),
    uploadRivalPhoto: (...args: unknown[]) => uploadRivalPhotoMock(...args),
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

    // The recurrence checkbox is disabled until a date is set
    const dateField = screen.getByLabelText(/fecha y hora/i) as HTMLInputElement;
    await userEvent.type(dateField, "2026-08-01T18:00");

    const checkbox = await screen.findByRole("checkbox", { name: /es recurrente/i });
    expect(screen.queryByLabelText(/frecuencia/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fecha final de la recurrencia/i)).not.toBeInTheDocument();

    await userEvent.click(checkbox);

    expect(await screen.findByLabelText(/frecuencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha final de la recurrencia/i)).toBeInTheDocument();
  }, 15000);

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

describe("SportEventDialog - fecha/hora/lugar opcionales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillNameAndType(typeName: string) {
    await userEvent.type(screen.getByLabelText(/nombre/i), "Evento sin fecha");
    const typeSelect = screen.getByLabelText(/tipo de evento/i);
    await userEvent.click(typeSelect);
    const option = await screen.findByRole("option", { name: typeName });
    await userEvent.click(option);
  }

  it("permite crear un evento sin fecha, hora ni lugar", async () => {
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await fillNameAndType("Entrenamiento");
    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.eveDateTime).toBeNull();
    expect(payload.startTime).toBeNull();
    expect(payload.location).toBeNull();
  }, 15000);

  it("deshabilita la casilla de recurrencia cuando no hay fecha", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    const checkbox = await screen.findByRole("checkbox", { name: /es recurrente/i });
    expect(checkbox).toBeDisabled();
    expect(
      screen.getByText(/añade una fecha para poder configurar la recurrencia/i)
    ).toBeInTheDocument();
  });

  it("habilita la casilla de recurrencia al introducir una fecha", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    const dateField = screen.getByLabelText(/fecha y hora/i) as HTMLInputElement;
    await userEvent.type(dateField, "2026-08-01T18:00");

    const checkbox = await screen.findByRole("checkbox", { name: /es recurrente/i });
    expect(checkbox).toBeEnabled();
  });
});

describe("SportEventDialog - rival inline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillMatchForm() {
    await userEvent.type(screen.getByLabelText(/nombre/i), "Partido jornada 1");
    const typeSelect = screen.getByLabelText(/tipo de evento/i);
    await userEvent.click(typeSelect);
    const option = await screen.findByRole("option", { name: "Partido" });
    await userEvent.click(option);
  }

  it("no muestra el selector de rival para tipos que no son partido", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await userEvent.type(screen.getByLabelText(/nombre/i), "Entreno");
    const typeSelect = screen.getByLabelText(/tipo de evento/i);
    await userEvent.click(typeSelect);
    const option = await screen.findByRole("option", { name: "Entrenamiento" });
    await userEvent.click(option);

    expect(screen.queryByText(/rival existente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/rival nuevo/i)).not.toBeInTheDocument();
  });

  it("son mutuamente excluyentes el modo rival existente y rival nuevo", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMatchForm();

    await userEvent.click(await screen.findByRole("radio", { name: /rival nuevo/i }));
    expect(await screen.findByLabelText(/nombre del rival/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^rival$/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /rival existente/i }));
    expect(screen.queryByLabelText(/nombre del rival/i)).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/^rival$/i)).toBeInTheDocument();
  }, 15000);

  it("crea un rival nuevo inline y lo envía en el payload como newRival", async () => {
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMatchForm();

    await userEvent.click(await screen.findByRole("radio", { name: /rival nuevo/i }));
    await userEvent.type(screen.getByLabelText(/nombre del rival/i), "CD Nuevo Rival");
    await userEvent.type(
      screen.getByLabelText(/categoría del rival/i),
      "Alevín"
    );

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.rivalId).toBeNull();
    expect(payload.newRival).toEqual({
      name: "CD Nuevo Rival",
      urlPhoto: null,
      category: "Alevín",
    });
  }, 15000);

  it("sube la foto del rival nuevo antes de crear el evento y usa la URL devuelta", async () => {
    uploadRivalPhotoMock.mockResolvedValue({ Url: "https://cdn.example.com/escudo.png" });
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMatchForm();

    await userEvent.click(await screen.findByRole("radio", { name: /rival nuevo/i }));
    await userEvent.type(screen.getByLabelText(/nombre del rival/i), "CD Nuevo Rival");

    const photoInput = screen.getByLabelText(
      /escudo\/foto del rival/i
    ) as HTMLInputElement;
    const photoFile = new File(["escudo"], "escudo.png", { type: "image/png" });
    await userEvent.upload(photoInput, photoFile);

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(uploadRivalPhotoMock).toHaveBeenCalledWith(photoFile));
    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.newRival).toEqual({
      name: "CD Nuevo Rival",
      urlPhoto: "https://cdn.example.com/escudo.png",
      category: null,
    });
  }, 15000);

  it("no sube ninguna foto ni llama a uploadRivalPhoto si no se selecciona archivo", async () => {
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMatchForm();

    await userEvent.click(await screen.findByRole("radio", { name: /rival nuevo/i }));
    await userEvent.type(screen.getByLabelText(/nombre del rival/i), "CD Nuevo Rival");

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    expect(uploadRivalPhotoMock).not.toHaveBeenCalled();
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.newRival.urlPhoto).toBeNull();
  }, 15000);

  it("muestra un error de validación si el modo rival nuevo no tiene nombre", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMatchForm();

    await userEvent.click(await screen.findByRole("radio", { name: /rival nuevo/i }));
    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    expect(
      await screen.findByText(/el nombre del rival nuevo es obligatorio/i)
    ).toBeInTheDocument();
    expect(createSportEventMock).not.toHaveBeenCalled();
  }, 15000);

  it("permite guardar un partido sin seleccionar ningún rival", async () => {
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMatchForm();

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.rivalId).toBeNull();
    expect(payload.newRival).toBeNull();
  }, 15000);

  it("precarga el rival guardado al editar un partido existente", async () => {
    getRivalsMock.mockResolvedValue([
      { id: "rival-1", name: "CD Rival" },
      { id: "rival-2", name: "CD Otro" },
    ]);

    render(
      <SportEventDialog
        open={true}
        teamId="team-1"
        event={{
          id: "evt-1",
          title: "Partido jornada 1",
          name: "Partido jornada 1",
          eventTypeId: 2,
          rivalId: "rival-1",
          teamId: "team-1",
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(
      await screen.findByRole("radio", { name: /rival existente/i })
    ).toBeChecked();

    const rivalSelect = await screen.findByLabelText(/^rival$/i);
    await waitFor(() => expect(rivalSelect).toHaveTextContent("CD Rival"));
  }, 15000);
});

describe("SportEventDialog - enlace de Google Maps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function fillMinimumValidForm() {
    await userEvent.type(screen.getByLabelText(/nombre/i), "Entrenamiento semanal");

    const typeSelect = screen.getByLabelText(/tipo de evento/i);
    await userEvent.click(typeSelect);
    const option = await screen.findByRole("option", { name: "Entrenamiento" });
    await userEvent.click(option);
  }

  it("muestra el campo de enlace de Google Maps", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    expect(
      await screen.findByLabelText(/enlace de google maps/i)
    ).toBeInTheDocument();
  });

  it("muestra un error de validación y no guarda si la URL no es válida", async () => {
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMinimumValidForm();

    await userEvent.type(
      screen.getByLabelText(/enlace de google maps/i),
      "esto no es una url"
    );

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    expect(
      await screen.findByText(/el enlace de ubicación debe ser una url válida/i)
    ).toBeInTheDocument();
    expect(createSportEventMock).not.toHaveBeenCalled();
    expect(updateSportEventMock).not.toHaveBeenCalled();
  }, 15000);

  it("incluye locationMapUrl en el payload cuando la URL es válida", async () => {
    createSportEventMock.mockResolvedValue({ id: "evt-1" });
    render(
      <SportEventDialog open={true} teamId="team-1" onClose={vi.fn()} onSaved={vi.fn()} />
    );
    await fillMinimumValidForm();

    await userEvent.type(
      screen.getByLabelText(/enlace de google maps/i),
      "https://maps.google.com/?q=Campo+Municipal"
    );

    await userEvent.click(screen.getByRole("button", { name: /crear/i }));

    await waitFor(() => expect(createSportEventMock).toHaveBeenCalledTimes(1));
    const payload = createSportEventMock.mock.calls[0][0];
    expect(payload.locationMapUrl).toBe("https://maps.google.com/?q=Campo+Municipal");
  }, 30000);

  it("precarga el campo con el locationMapUrl existente al editar un evento", async () => {
    render(
      <SportEventDialog
        open={true}
        teamId="team-1"
        event={{
          id: "evt-1",
          title: "Entreno semanal",
          name: "Entreno semanal",
          eventTypeId: 1,
          teamId: "team-1",
          location: "Campo Municipal Norte",
          locationMapUrl: "https://maps.google.com/?q=Campo+Municipal+Norte",
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const field = (await screen.findByLabelText(
      /enlace de google maps/i
    )) as HTMLInputElement;
    expect(field.value).toBe("https://maps.google.com/?q=Campo+Municipal+Norte");
  });
});
