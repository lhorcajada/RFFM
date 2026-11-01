import { describe, expect, it } from "vitest";
import gameTheme from "../muiGameTheme";
import devTheme from "../muiDevTheme";

type CssBaselineOverrides = Record<string, Record<string, string>>;

function rootTokens(theme: typeof gameTheme): Record<string, string> {
  const overrides = theme.components?.MuiCssBaseline?.styleOverrides as CssBaselineOverrides | undefined;
  return Object.values(overrides ?? {}).find((rules) => "--rffm-dash-accent" in rules) ?? {};
}

describe.each([
  ["tema de juego", gameTheme],
  ["tema de desarrollo", devTheme],
])("%s — texto sobre el acento del panel", (_name, theme) => {
  it("define el color del texto sobre el acento, para que botones como «Abrir panel del equipo» se lean", () => {
    const tokens = rootTokens(theme);

    expect(tokens["--rffm-dash-accent"]).toBeDefined();
    expect(tokens["--rffm-dash-on-accent"]).toBeDefined();
  });
});
