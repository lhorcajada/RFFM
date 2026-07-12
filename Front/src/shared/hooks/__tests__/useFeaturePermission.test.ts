import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetMyPermissions = vi.fn();

vi.mock("../../services/permissions/permissionService", () => ({
  getMyPermissions: () => mockGetMyPermissions(),
}));

import { useFeaturePermission } from "../useFeaturePermission";

describe("useFeaturePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hasAccess=true when the route is present in featurePermissions", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "ClubDirector",
      featurePermissions: [{ featureName: "ClubManagement", featureRoute: "/coach/clubs", permissionType: "ReadWrite" }],
      pagePermissions: [],
    });

    const { result } = renderHook(() => useFeaturePermission("/coach/clubs"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(true);
  });

  it("returns hasAccess=false when the route is absent", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "Coach",
      featurePermissions: [{ featureName: "Dashboard", featureRoute: "/coach/dashboard", permissionType: "Read" }],
      pagePermissions: [],
    });

    const { result } = renderHook(() => useFeaturePermission("/coach/clubs"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(false);
  });

  it("returns hasAccess=false when the request fails", async () => {
    mockGetMyPermissions.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useFeaturePermission("/coach/clubs"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(false);
  });
});
