import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EventAttendanceBadges } from "../EventAttendanceBadges";

function baseSummary(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "e1",
    convocados: 10,
    going: 7,
    pending: 2,
    notGoing: 1,
    attendancePercentage: 70,
    myStatus: null,
    myStatusId: null,
    myConvocationId: null,
    ...overrides,
  };
}

describe("EventAttendanceBadges", () => {
  it("coach view shows convocados/going/pending/notGoing/percentage", () => {
    render(<EventAttendanceBadges summary={baseSummary() as any} isPlayer={false} />);

    expect(screen.getByText(/Convocados.*10/i)).toBeInTheDocument();
    expect(screen.getByText(/Van.*7/i)).toBeInTheDocument();
    expect(screen.getByText(/Pendientes.*2/i)).toBeInTheDocument();
    expect(screen.getByText(/No van.*1/i)).toBeInTheDocument();
    expect(screen.getByText(/70/)).toBeInTheDocument();
  });

  it("player view shows the decided status ('Aceptado'), never aggregate counts", () => {
    const summary = baseSummary({ myStatus: "Accepted", myStatusId: 2, myConvocationId: "conv-1" });

    render(<EventAttendanceBadges summary={summary as any} isPlayer={true} />);

    expect(screen.getByText(/Tu estado.*Aceptado/i)).toBeInTheDocument();
    expect(screen.queryByText(/Convocados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Van.*7/i)).not.toBeInTheDocument();
  });

  it("player view shows 'Rechazado' for a Deconvoke status", () => {
    const summary = baseSummary({ myStatus: "Deconvoke", myStatusId: 5, myConvocationId: "conv-1" });
    render(<EventAttendanceBadges summary={summary as any} isPlayer={true} />);
    expect(screen.getByText(/Tu estado.*Rechazado/i)).toBeInTheDocument();
  });

  it("player view shows 'Justificado' for a Justified status", () => {
    const summary = baseSummary({ myStatus: "Justified", myStatusId: 4, myConvocationId: "conv-1" });
    render(<EventAttendanceBadges summary={summary as any} isPlayer={true} />);
    expect(screen.getByText(/Tu estado.*Justificado/i)).toBeInTheDocument();
  });

  it("player view renders nothing when myStatus is null (not convoked to this event)", () => {
    const summary = baseSummary({ myStatus: null, myStatusId: null, myConvocationId: null });

    const { container } = render(<EventAttendanceBadges summary={summary as any} isPlayer={true} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Pendiente/i)).not.toBeInTheDocument();
  });

  it("player view shows 'Pendiente' when myStatus is Pending (convoked, not yet decided)", () => {
    const summary = baseSummary({ myStatus: "Pending", myStatusId: 1, myConvocationId: "conv-1" });

    render(<EventAttendanceBadges summary={summary as any} isPlayer={true} />);

    expect(screen.getByText(/Tu estado.*Pendiente/i)).toBeInTheDocument();
  });

  it("renders nothing when summary is undefined", () => {
    const { container } = render(<EventAttendanceBadges summary={undefined} isPlayer={false} />);

    expect(container.firstChild).toBeNull();
  });
});
