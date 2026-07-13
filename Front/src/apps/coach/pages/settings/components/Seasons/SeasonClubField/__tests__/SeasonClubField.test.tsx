import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUserClubs = vi.fn();
const mockCreateClubMultipart = vi.fn();
vi.mock("../../../../../../services/clubService", () => ({
  default: {
    getUserClubs: (...args: unknown[]) => mockGetUserClubs(...args),
    createClubMultipart: (...args: unknown[]) => mockCreateClubMultipart(...args),
  },
}));

const mockGetCountries = vi.fn();
vi.mock("../../../../../../services/countryService", () => ({
  default: {
    getCountries: (...args: unknown[]) => mockGetCountries(...args),
  },
}));

import i18next from "../../../../../../../../shared/i18n/i18n";
import SeasonClubField from "../SeasonClubField";

function renderField(props: Partial<React.ComponentProps<typeof SeasonClubField>> = {}) {
  const onChange = vi.fn();
  render(<SeasonClubField value="" onChange={onChange} {...props} />);
  return { onChange };
}

describe("SeasonClubField", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18next.changeLanguage("es");
    mockGetCountries.mockResolvedValue([{ id: 1, name: "España", code: "ES" }]);
  });

  it("carga y muestra los clubes del coach", async () => {
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);

    renderField();

    await waitFor(() => expect(mockGetUserClubs).toHaveBeenCalled());
    const select = await screen.findByLabelText("Club");
    await userEvent.click(select);
    expect(await screen.findByRole("option", { name: "FC Uno" })).toBeInTheDocument();
  });

  it("llama a onChange con el id del club seleccionado", async () => {
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);
    const { onChange } = renderField();

    const select = await screen.findByLabelText("Club");
    await userEvent.click(select);
    const option = await screen.findByRole("option", { name: "FC Uno" });
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("club-1");
  });

  it("muestra una opción para crear club cuando la lista está vacía", async () => {
    mockGetUserClubs.mockResolvedValue([]);

    renderField();

    await waitFor(() => expect(mockGetUserClubs).toHaveBeenCalled());
    expect(await screen.findByText(/No tienes clubes/i)).toBeInTheDocument();
  });

  it("abre el formulario de creación al elegir 'Crear club nuevo'", async () => {
    mockGetUserClubs.mockResolvedValue([
      { clubId: "club-1", clubName: "FC Uno", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
    ]);
    renderField();

    const select = await screen.findByLabelText("Club");
    await userEvent.click(select);
    const createOption = await screen.findByRole("option", { name: /Crear club nuevo/i });
    await userEvent.click(createOption);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(within(await screen.findByRole("dialog")).getByText("Crear club")).toBeInTheDocument();
  });

  it("crea el club y selecciona el nuevo club automáticamente", async () => {
    mockGetUserClubs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { clubId: "club-new", clubName: "Nuevo Club", shieldUrl: "", role: "Coach", roleId: 2, isCreator: true },
      ]);
    mockCreateClubMultipart.mockResolvedValue({ id: "club-new" });

    const { onChange } = renderField();

    const createButton = await screen.findByRole("button", { name: /crear club/i });
    await userEvent.click(createButton);

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Nuevo Club");

    await userEvent.click(within(dialog).getByLabelText("País"));
    const countryOption = await screen.findByRole("option", { name: "España" });
    await userEvent.click(countryOption);

    await userEvent.click(within(dialog).getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(mockCreateClubMultipart).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("club-new"));
  });

  it("muestra el mensaje localizado cuando se supera la cuota de clubes", async () => {
    mockGetUserClubs.mockResolvedValue([]);
    mockCreateClubMultipart.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: "club_quota_exceeded",
          detail: "Has alcanzado el número máximo de clubes que puedes crear (3).",
        },
      },
    });

    renderField();

    const createButton = await screen.findByRole("button", { name: /crear club/i });
    await userEvent.click(createButton);

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Otro Club");
    await userEvent.click(within(dialog).getByLabelText("País"));
    const countryOption = await screen.findByRole("option", { name: "España" });
    await userEvent.click(countryOption);
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear" }));

    expect(
      await within(dialog).findByText("Has alcanzado el número máximo de clubes que puedes crear (3).")
    ).toBeInTheDocument();
  });

  it("muestra el mensaje localizado de validación", async () => {
    mockGetUserClubs.mockResolvedValue([]);
    mockCreateClubMultipart.mockRejectedValue({
      response: {
        status: 400,
        data: { code: "ValidationFailed" },
      },
    });

    renderField();

    const createButton = await screen.findByRole("button", { name: /crear club/i });
    await userEvent.click(createButton);

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Otro Club");
    await userEvent.click(within(dialog).getByLabelText("País"));
    const countryOption = await screen.findByRole("option", { name: "España" });
    await userEvent.click(countryOption);
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear" }));

    expect(
      await within(dialog).findByText(
        "Algunos datos del formulario no son válidos. Revisa los campos marcados."
      )
    ).toBeInTheDocument();
  });
});
