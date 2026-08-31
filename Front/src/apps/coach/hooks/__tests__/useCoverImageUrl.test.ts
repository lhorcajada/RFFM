import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../shared/services/imageService", () => ({
  fetchPublicStorageFile: vi.fn(),
}));

import { fetchPublicStorageFile } from "../../../../shared/services/imageService";
import { useCoverImageUrl } from "../useCoverImageUrl";

describe("useCoverImageUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the object URL for a given storage path", async () => {
    vi.mocked(fetchPublicStorageFile).mockResolvedValue("blob:mock-url");

    const { result } = renderHook(() => useCoverImageUrl("newsimages/xyz.jpg"));

    expect(result.current).toBeNull();

    await waitFor(() => {
      expect(result.current).toBe("blob:mock-url");
    });
    expect(fetchPublicStorageFile).toHaveBeenCalledWith("newsimages/xyz.jpg");
  });

  it("returns null for an empty/undefined path without calling the service", () => {
    const { result } = renderHook(() => useCoverImageUrl(""));
    expect(result.current).toBeNull();
    expect(fetchPublicStorageFile).not.toHaveBeenCalled();
  });

  it("revokes the object URL on unmount", async () => {
    vi.mocked(fetchPublicStorageFile).mockResolvedValue("blob:mock-url");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useCoverImageUrl("newsimages/xyz.jpg"));
    await waitFor(() => {
      expect(result.current).toBe("blob:mock-url");
    });

    unmount();

    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-url");
    revokeSpy.mockRestore();
  });

  it("re-fetches when the path changes, revoking the previous object URL", async () => {
    vi.mocked(fetchPublicStorageFile)
      .mockResolvedValueOnce("blob:first")
      .mockResolvedValueOnce("blob:second");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { result, rerender } = renderHook(({ path }) => useCoverImageUrl(path), {
      initialProps: { path: "a.jpg" },
    });
    await waitFor(() => expect(result.current).toBe("blob:first"));

    rerender({ path: "b.jpg" });
    await waitFor(() => expect(result.current).toBe("blob:second"));

    expect(revokeSpy).toHaveBeenCalledWith("blob:first");
    revokeSpy.mockRestore();
  });
});
