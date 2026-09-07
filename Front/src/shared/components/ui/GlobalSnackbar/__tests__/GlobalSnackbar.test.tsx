import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GlobalSnackbar from "../GlobalSnackbar";

function showToast(message: string, severity: "success" | "error" | "info" | "warning" = "success") {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("rffm.show_snackbar", { detail: { message, severity } }),
    );
  });
}

describe("GlobalSnackbar", () => {
  it("nunca deja el contenedor del toast bloqueando clicks de elementos que están debajo, ni mientras está visible ni tras autoocultarse", async () => {
    render(<GlobalSnackbar />);

    showToast("Sesión guardada correctamente");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sesión guardada correctamente");

    // The Snackbar's anchoring root spans a fixed-position box in the same corner where
    // this app places page-level action buttons (e.g. Guardar/Cancelar in
    // NewSessionPage). That root must never intercept pointer events — only the visible
    // Alert inside it should — otherwise real screen coordinates behind the (possibly
    // invisible/closed) toast become unclickable.
    const root = document.querySelector(".MuiSnackbar-root") as HTMLElement;
    expect(root).toBeTruthy();
    expect(getComputedStyle(root).pointerEvents).toBe("none");
    expect(getComputedStyle(alert).pointerEvents).toBe("auto");

    // After autohide, the root must still be present (or gone) but never intercept clicks —
    // pointerEvents must remain "none" so any button underneath stays clickable.
    await waitFor(
      () => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      },
      { timeout: 6000 },
    );

    const rootAfterClose = document.querySelector(".MuiSnackbar-root") as HTMLElement | null;
    if (rootAfterClose) {
      expect(getComputedStyle(rootAfterClose).pointerEvents).toBe("none");
    }
  });

  it("sigue permitiendo cerrar el toast manualmente con el botón de cerrar del Alert", async () => {
    render(<GlobalSnackbar />);
    showToast("Error al guardar la sesión.", "error");

    const alert = await screen.findByRole("alert");
    const closeButton = alert.querySelector("button");
    expect(closeButton).toBeTruthy();
    expect(closeButton ? getComputedStyle(closeButton).pointerEvents : "none").not.toBe("none");
  });
});
