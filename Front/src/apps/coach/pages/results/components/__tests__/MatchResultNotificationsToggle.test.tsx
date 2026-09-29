import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPreference = vi.fn();
const mockSetPreference = vi.fn();
vi.mock("../../../../services/matchResultNotificationService", () => ({
  getMatchResultNotificationPreference: () => mockGetPreference(),
  setMatchResultNotificationPreference: (enabled: boolean) => mockSetPreference(enabled),
}));

const mockUsePushActivationStatus = vi.fn();
vi.mock("../../../../hooks/usePushActivationStatus", () => ({
  usePushActivationStatus: () => mockUsePushActivationStatus(),
}));

import MatchResultNotificationsToggle from "../MatchResultNotificationsToggle";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}|{JSON.stringify(location.state)}
    </div>
  );
}

function renderToggle() {
  return render(
    <MemoryRouter initialEntries={["/coach/results"]}>
      <Routes>
        <Route path="/coach/results" element={<MatchResultNotificationsToggle />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MatchResultNotificationsToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePushActivationStatus.mockReturnValue({ shouldPrompt: false });
    mockSetPreference.mockResolvedValue(undefined);
  });

  it("muestra el interruptor activado con el nombre del equipo principal", async () => {
    mockGetPreference.mockResolvedValue({ enabled: true, teamName: "CD Ejemplo A" });

    renderToggle();

    const toggle = await screen.findByRole("checkbox", {
      name: /notificarme los resultados de cd ejemplo a/i,
    });
    expect(toggle).toBeChecked();
  });

  it("muestra el interruptor desactivado si el usuario se dio de baja", async () => {
    mockGetPreference.mockResolvedValue({ enabled: false, teamName: "CD Ejemplo A" });

    renderToggle();

    expect(await screen.findByRole("checkbox", { name: /notificarme los resultados/i })).not.toBeChecked();
  });

  it("al desactivarlo guarda enabled=false y se queda desactivado", async () => {
    mockGetPreference.mockResolvedValue({ enabled: true, teamName: "CD Ejemplo A" });
    renderToggle();
    const toggle = await screen.findByRole("checkbox", { name: /notificarme los resultados/i });

    await userEvent.click(toggle);

    expect(mockSetPreference).toHaveBeenCalledWith(false);
    await waitFor(() => expect(toggle).not.toBeChecked());
  });

  it("si falla el guardado revierte el interruptor y avisa con un snackbar de error", async () => {
    mockGetPreference.mockResolvedValue({ enabled: true, teamName: "CD Ejemplo A" });
    mockSetPreference.mockRejectedValue(new Error("boom"));
    const snackbarListener = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarListener);
    renderToggle();
    const toggle = await screen.findByRole("checkbox", { name: /notificarme los resultados/i });

    await userEvent.click(toggle);

    await waitFor(() => expect(toggle).toBeChecked());
    expect(snackbarListener).toHaveBeenCalledTimes(1);
    const event = snackbarListener.mock.calls[0][0] as CustomEvent<{ severity: string }>;
    expect(event.detail.severity).toBe("error");
    window.removeEventListener("rffm.show_snackbar", snackbarListener);
  });

  it("sin equipo principal no muestra el interruptor y enlaza a los ajustes para guardarlo", async () => {
    mockGetPreference.mockResolvedValue({ enabled: true, teamName: null });

    renderToggle();

    expect(await screen.findByText(/para recibir sus resultados/i)).toHaveTextContent(
      "Guarda tu equipo en Ajustes para recibir sus resultados."
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ajustes/i })).toHaveAttribute("href", "/federation/settings");
  });

  it("si el navegador no tiene suscripción push enlaza a Ajustes > Notificaciones", async () => {
    mockGetPreference.mockResolvedValue({ enabled: true, teamName: "CD Ejemplo A" });
    mockUsePushActivationStatus.mockReturnValue({ shouldPrompt: true });
    renderToggle();

    await userEvent.click(await screen.findByRole("button", { name: /activar notificaciones/i }));

    expect(screen.getByTestId("location")).toHaveTextContent('/coach/settings|{"section":"notifications"}');
  });

  it("con el navegador suscrito no muestra la ayuda de activación", async () => {
    mockGetPreference.mockResolvedValue({ enabled: true, teamName: "CD Ejemplo A" });

    renderToggle();

    await screen.findByRole("checkbox", { name: /notificarme los resultados/i });
    expect(screen.queryByRole("button", { name: /activar notificaciones/i })).not.toBeInTheDocument();
  });

  it("si no se puede leer la preferencia no muestra nada", async () => {
    mockGetPreference.mockRejectedValue(new Error("boom"));

    const { container } = renderToggle();

    await waitFor(() => expect(mockGetPreference).toHaveBeenCalled());
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
