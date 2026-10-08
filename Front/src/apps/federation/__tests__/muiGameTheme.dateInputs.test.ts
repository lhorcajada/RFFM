import { describe, it, expect } from "vitest";
import gameTheme from "../muiGameTheme";
import devTheme from "../muiDevTheme";

type InputBaseOverrides = { input?: Record<string, unknown> } | undefined;

describe("muiGameTheme — inputs de fecha/hora", () => {
  it("renderiza los inputs nativos con esquema de color oscuro para que los iconos de fecha y hora sean claros", () => {
    const overrides = gameTheme.components?.MuiInputBase?.styleOverrides as InputBaseOverrides;

    expect(overrides?.input?.colorScheme).toBe("dark");
  });

  it("mantiene el esquema de color oscuro en el tema de desarrollo", () => {
    const overrides = devTheme.components?.MuiInputBase?.styleOverrides as InputBaseOverrides;

    expect(overrides?.input?.colorScheme).toBe("dark");
  });
});
