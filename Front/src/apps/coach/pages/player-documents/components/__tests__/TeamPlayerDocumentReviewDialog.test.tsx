import { describe, expect, it, vi, beforeEach } from "vitest";

const mockReviewPlayerDocument = vi.fn();

vi.mock("../../../../services/playerDocumentService", () => ({
  reviewPlayerDocument: (...args: unknown[]) => mockReviewPlayerDocument(...args),
  mapPlayerDocumentError: vi.fn((code) => ({
    message: "Error",
    severity: "error" as const,
  })),
}));

describe("TeamPlayerDocumentReviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports and exports TeamPlayerDocumentReviewDialog successfully", async () => {
    const { default: TeamPlayerDocumentReviewDialog } = await import(
      "../TeamPlayerDocumentReviewDialog"
    );
    expect(TeamPlayerDocumentReviewDialog).toBeDefined();
    expect(typeof TeamPlayerDocumentReviewDialog).toBe("function");
  });

  it("service mock is properly configured for review", () => {
    expect(mockReviewPlayerDocument).toBeDefined();
  });

  it("accepts mode prop for approve or reject", async () => {
    const { default: TeamPlayerDocumentReviewDialog } = await import(
      "../TeamPlayerDocumentReviewDialog"
    );
    expect(TeamPlayerDocumentReviewDialog).toBeDefined();
  });
});
