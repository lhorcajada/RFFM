import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";

vi.mock("../../../../services/deconvocationRulesService", () => ({
  saveDeconvocationRules: vi.fn(),
  resetDeconvocationRules: vi.fn(),
}));

import { resetDeconvocationRules, saveDeconvocationRules } from "../../../../services/deconvocationRulesService";
import DeconvocationRulesDialog from "../DeconvocationRulesDialog";
import { DEFAULT_RULES } from "../../utils/rules/defaultRules";
import { buildDefaultRule } from "../../utils/rules/ruleCatalog";

const mockSave = saveDeconvocationRules as ReturnType<typeof vi.fn>;
const mockReset = resetDeconvocationRules as ReturnType<typeof vi.fn>;

function renderDialog(rules = DEFAULT_RULES, squadSize?: number) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<DeconvocationRulesDialog open teamId="t1" rules={rules} squadSize={squadSize} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

const card = (title: string) => screen.getByRole("group", { name: title });

describe("DeconvocationRulesDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSave.mockResolvedValue({ rules: [], isDefault: false });
    mockReset.mockResolvedValue(undefined);
  });

  it("muestra una tarjeta por regla", () => {
    renderDialog();
    expect(screen.getAllByRole("group")).toHaveLength(DEFAULT_RULES.length);
  });

  it("separa los ajustes y los pesos de cada regla", () => {
    renderDialog();
    expect(within(card("Desconvocado por decisión técnica")).getByText("Ajustes")).toBeInTheDocument();
    expect(within(card("Nivel ponderado")).getByText("Pesos")).toBeInTheDocument();
  });

  it("muestra qué mínimo de convocatorias resulta según los partidos disponibles", () => {
    renderDialog(DEFAULT_RULES, 24);
    const preview = within(card("Mínimo de convocatorias")).getByRole("list", { name: "Vista previa del mínimo" });

    expect(within(preview).getByText("Si pudo jugar 20 partidos: mínimo 15 convocatorias")).toBeInTheDocument();
    expect(within(preview).getByText("Si pudo jugar 10 partidos: mínimo 7 convocatorias")).toBeInTheDocument();
  });

  it("la vista previa se recalcula al cambiar el porcentaje", () => {
    renderDialog(DEFAULT_RULES, 24);
    const minCalls = within(card("Mínimo de convocatorias"));
    fireEvent.change(minCalls.getByLabelText("Porcentaje del reparto justo que se exige"), { target: { value: "50" } });

    expect(minCalls.getByText("Si pudo jugar 20 partidos: mínimo 7 convocatorias")).toBeInTheDocument();
  });

  it("no muestra la vista previa si no se conoce el tamaño de la plantilla", () => {
    renderDialog(DEFAULT_RULES);

    expect(screen.queryByRole("list", { name: "Vista previa del mínimo" })).not.toBeInTheDocument();
  });

  it("no muestra la sección de pesos si la regla no tiene", () => {
    renderDialog();
    expect(within(card("Descanso por lesión")).queryByText("Pesos")).not.toBeInTheDocument();
  });

  it("marca las reglas obligatorias", () => {
    renderDialog();
    expect(within(card("Lesionado")).getByText("Obligatoria")).toBeInTheDocument();
    expect(within(card("Descanso por lesión")).queryByText("Obligatoria")).not.toBeInTheDocument();
  });

  it("guarda el texto y los puntos editados", async () => {
    const { onSaved, onClose } = renderDialog();
    const rest = within(card("Descanso por lesión"));
    fireEvent.change(rest.getByLabelText("Texto"), { target: { value: "Mi descanso" } });
    fireEvent.change(rest.getByLabelText("Jornadas de protección"), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const [teamId, saved] = mockSave.mock.calls[0];
    expect(teamId).toBe("t1");
    expect(saved.find((r: { condition: string }) => r.condition === "injuryRest")).toMatchObject({
      text: "Mi descanso",
      points: { window: 2 },
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("no permite guardar una regla sin texto", () => {
    renderDialog();
    fireEvent.change(within(card("Descanso por lesión")).getByLabelText("Texto"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("al añadir una regla solo ofrece las condiciones no usadas", () => {
    renderDialog(DEFAULT_RULES.filter((r) => r.condition !== "injuryRest" && r.condition !== "rivalDifficulty"));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Condición de la nueva regla" }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.sort()).toEqual(["Descanso por lesión", "Dificultad del rival"]);
  });

  it("añade la regla elegida con sus valores por defecto", () => {
    renderDialog(DEFAULT_RULES.filter((r) => r.condition !== "injuryRest"));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Condición de la nueva regla" }));
    fireEvent.click(screen.getByRole("option", { name: "Descanso por lesión" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir regla" }));

    expect(within(card("Descanso por lesión")).getByLabelText("Jornadas de protección")).toHaveValue(
      buildDefaultRule("injuryRest").points.window,
    );
  });

  it("oculta el alta de reglas cuando ya están todas las condiciones", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "Añadir regla" })).not.toBeInTheDocument();
  });

  it("elimina una regla tras confirmarlo", async () => {
    renderDialog();
    fireEvent.click(within(card("Descanso por lesión")).getByRole("button", { name: "Eliminar regla Descanso por lesión" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(screen.queryByRole("group", { name: "Descanso por lesión" })).not.toBeInTheDocument());
  });

  it("no elimina la regla si se cancela la confirmación", async () => {
    renderDialog();
    fireEvent.click(within(card("Descanso por lesión")).getByRole("button", { name: "Eliminar regla Descanso por lesión" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    return waitFor(() => expect(screen.getByRole("group", { name: "Descanso por lesión" })).toBeInTheDocument());
  });

  it("avisa al eliminar una regla obligatoria", () => {
    renderDialog();
    fireEvent.click(within(card("Lesionado")).getByRole("button", { name: "Eliminar regla Lesionado" }));
    expect(screen.getByText(/obligatoria/i, { selector: "p" })).toBeInTheDocument();
  });

  it("restablece los valores por defecto tras confirmarlo", async () => {
    const { onSaved } = renderDialog(DEFAULT_RULES.filter((r) => r.condition !== "injuryRest"));
    fireEvent.click(screen.getByRole("button", { name: "Restablecer valores por defecto" }));
    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
