import { describe, it, expect } from "vitest";
import coachTheme from "../muiCoachTheme";

describe("muiCoachTheme — inputs de fecha/hora", () => {
  it("renderiza los inputs nativos con esquema de color oscuro para que el icono de calendario sea claro", () => {
    const overrides = coachTheme.components?.MuiInputBase?.styleOverrides as
      | { input?: Record<string, unknown> }
      | undefined;

    expect(overrides?.input?.colorScheme).toBe("dark");
  });
});
