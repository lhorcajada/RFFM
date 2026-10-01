import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HabilidadesPicker from "../HabilidadesPicker";

describe("HabilidadesPicker", () => {
  it("permite elegir habilidades del vocabulario", async () => {
    const onChange = vi.fn();
    render(<HabilidadesPicker value={["Pase"]} onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox", { name: /habilidades/i }));
    await userEvent.click(await screen.findByRole("option", { name: "Percepción" }));

    expect(onChange).toHaveBeenCalledWith(["Pase", "Percepción"]);
  });

  it("con cinco habilidades elegidas deshabilita el resto", async () => {
    render(
      <HabilidadesPicker value={["Pase", "Regate", "Remate", "Centro", "Despeje"]} onChange={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: /habilidades/i }));

    expect(await screen.findByRole("option", { name: "Percepción" })).toHaveAttribute("aria-disabled", "true");
  });
});
