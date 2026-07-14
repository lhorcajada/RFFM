import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetMyPermissions = vi.fn();

vi.mock("../../services/permissions/permissionService", () => ({
  getMyPermissions: () => mockGetMyPermissions(),
}));

import { usePermissions } from "../usePermissions";

describe("usePermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in a loading state", () => {
    mockGetMyPermissions.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePermissions());

    expect(result.current.loading).toBe(true);
  });

  it("exposes role and featurePermissions after a successful fetch", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "Player",
      featurePermissions: [
        { featureName: "Squad", featureRoute: "/coach/squad", permissionType: "Read" },
      ],
      pagePermissions: [],
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.role).toBe("Player");
    expect(result.current.featurePermissions).toHaveLength(1);
  });

  it("hasFeatureAccess returns true when the route is present in featurePermissions", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "Player",
      featurePermissions: [
        { featureName: "Squad", featureRoute: "/coach/squad", permissionType: "Read" },
      ],
      pagePermissions: [],
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasFeatureAccess("/coach/squad")).toBe(true);
  });

  it("hasFeatureAccess returns false when the route is absent", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "Player",
      featurePermissions: [
        { featureName: "Squad", featureRoute: "/coach/squad", permissionType: "Read" },
      ],
      pagePermissions: [],
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasFeatureAccess("/coach/settings")).toBe(false);
  });

  it("hasFeatureAccess returns true for any route when role is Administrator, even with an empty list", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "Administrator",
      featurePermissions: [],
      pagePermissions: [],
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasFeatureAccess("/coach/settings")).toBe(true);
    expect(result.current.hasFeatureAccess("/coach/clubs")).toBe(true);
  });

  it("hasFeatureAccess returns false for every route when the request fails", async () => {
    mockGetMyPermissions.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasFeatureAccess("/coach/squad")).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
