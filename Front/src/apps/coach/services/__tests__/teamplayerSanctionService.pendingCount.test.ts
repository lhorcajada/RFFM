import { describe, it, expect } from "vitest";
import { getPendingSanctionsCount } from "../teamplayerSanctionService";
import type { SanctionRecord } from "../teamplayerSanctionService";

function sanction(overrides: Partial<SanctionRecord>): SanctionRecord {
  return {
    id: "s1",
    startDate: "2026-01-01",
    sanctionType: "Amonestación",
    description: null,
    estimatedEnd: null,
    endDate: null,
    isAutomatic: false,
    fine: null,
    ...overrides,
  };
}

describe("getPendingSanctionsCount", () => {
  it("counts a sanction with status Pending", () => {
    const count = getPendingSanctionsCount([sanction({ status: "Pending" })]);
    expect(count).toBe(1);
  });

  it("counts a sanction with no endDate and no status field (legacy inference)", () => {
    const count = getPendingSanctionsCount([sanction({ endDate: null })]);
    expect(count).toBe(1);
  });

  it("does not count a sanction with status Fulfilled and no pending economic amount", () => {
    const count = getPendingSanctionsCount([
      sanction({ status: "Fulfilled", endDate: "2026-02-01", fine: 50, amountPaid: 50 }),
    ]);
    expect(count).toBe(0);
  });

  it("counts a Fulfilled sanction that still has an unpaid fine", () => {
    const count = getPendingSanctionsCount([
      sanction({ status: "Fulfilled", endDate: "2026-02-01", fine: 50, amountPaid: 20 }),
    ]);
    expect(count).toBe(1);
  });

  it("counts a Fulfilled sanction using pendingAmount when provided by the backend", () => {
    const count = getPendingSanctionsCount([
      sanction({ status: "Fulfilled", endDate: "2026-02-01", pendingAmount: 10 }),
    ]);
    expect(count).toBe(1);
  });

  it("does not double count a sanction that is both not-served and unpaid", () => {
    const count = getPendingSanctionsCount([
      sanction({ status: "Pending", fine: 50, amountPaid: 0 }),
    ]);
    expect(count).toBe(1);
  });

  it("returns 0 for an empty list", () => {
    expect(getPendingSanctionsCount([])).toBe(0);
  });

  it("sums across multiple sanctions", () => {
    const count = getPendingSanctionsCount([
      sanction({ id: "a", status: "Pending" }),
      sanction({ id: "b", status: "Fulfilled", endDate: "2026-02-01", fine: 10, amountPaid: 10 }),
      sanction({ id: "c", status: "Fulfilled", endDate: "2026-02-01", fine: 10, amountPaid: 0 }),
    ]);
    expect(count).toBe(2);
  });
});
