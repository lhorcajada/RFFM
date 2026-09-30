import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ObservationForm from "../ObservationForm";
import type { SubprincipioOption } from "../../../hooks/useSubprincipioOptions";

const OPTIONS: SubprincipioOption[] = [
  { id: "s-11", label: "1.1 Repliegue", group: "Defensa organizada › 1. Presión" },
  { id: "s-23", label: "2.3 Circular para desordenar", group: "Ataque organizado › 2. Ataque posicional" },
];

const TODAY = new Date().toISOString().slice(0, 10);

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined), hasModel = true) {
  render(<ObservationForm options={OPTIONS} hasModel={hasModel} saving={false} onSubmit={onSubmit} />);
  return onSubmit;
}

async function selectSubprincipio(label: string) {
  await userEvent.click(screen.getByRole("combobox", { name: /subprincipio/i }));
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

describe("ObservationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deshabilita Guardar hasta elegir subprincipio y valoración", async () => {
    renderForm();
    const save = screen.getByRole("button", { name: /guardar/i });
    expect(save).toBeDisabled();

    await selectSubprincipio("2.3 Circular para desordenar");
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "No lo hace" }));
    expect(save).toBeEnabled();
  });

  it("envía la observación con la fecha de hoy por defecto", async () => {
    const onSubmit = renderForm();

    await selectSubprincipio("2.3 Circular para desordenar");
    await userEvent.click(screen.getByRole("button", { name: "No lo hace" }));
    await userEvent.type(screen.getByLabelText(/comentario/i), "Busca siempre el pase vertical");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      date: TODAY,
      subprincipioId: "s-23",
      assessment: "NotAchieved",
      comment: "Busca siempre el pase vertical",
    });
  });

  it("tras guardar limpia subprincipio, valoración y comentario pero mantiene la fecha", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: "2026-09-14" } });
    await selectSubprincipio("1.1 Repliegue");
    await userEvent.click(screen.getByRole("button", { name: "A veces" }));
    await userEvent.type(screen.getByLabelText(/comentario/i), "Llega tarde al repliegue");

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole("combobox", { name: /subprincipio/i })).toHaveValue(""));
    expect(screen.getByLabelText(/comentario/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: "A veces" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText(/fecha/i)).toHaveValue("2026-09-14");
  });

  it("mantiene los valores si el guardado falla", async () => {
    renderForm(vi.fn().mockRejectedValue(new Error("400")));
    await selectSubprincipio("1.1 Repliegue");
    await userEvent.click(screen.getByRole("button", { name: "Lo hace" }));

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Lo hace" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("combobox", { name: /subprincipio/i })).toHaveValue("1.1 Repliegue");
  });

  it("muestra un aviso en lugar del formulario si el equipo no tiene modelo de juego", () => {
    renderForm(vi.fn(), false);

    expect(screen.getByText(/no tiene modelo de juego en la temporada activa/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
  });
});
