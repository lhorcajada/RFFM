import React from "react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWebPushForegroundBridge } from "../useWebPushForegroundBridge";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useWebPushForegroundBridge", () => {
  let listeners: Record<string, (event: any) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        addEventListener: vi.fn((type: string, cb: (event: any) => void) => {
          listeners[type] = cb;
        }),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    // @ts-expect-error jsdom stub cleanup
    delete (navigator as any).serviceWorker;
  });

  it("dispatches rffm.show_snackbar when a push message arrives in the foreground", () => {
    const snackbarSpy = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbarSpy as EventListener);

    renderHook(() => useWebPushForegroundBridge(), { wrapper: Wrapper });

    listeners["message"]({ data: { type: "rffm.push_received", title: "T", body: "B" } });

    expect(snackbarSpy).toHaveBeenCalledTimes(1);
    const event = snackbarSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ message: "B", severity: "info" });

    window.removeEventListener("rffm.show_snackbar", snackbarSpy as EventListener);
  });

  it("navigates when a notification click message arrives", () => {
    renderHook(() => useWebPushForegroundBridge(), { wrapper: Wrapper });

    listeners["message"]({ data: { type: "rffm.notification_click", deepLinkPath: "/coach/news/123" } });

    expect(navigateMock).toHaveBeenCalledWith("/coach/news/123");
  });
});
