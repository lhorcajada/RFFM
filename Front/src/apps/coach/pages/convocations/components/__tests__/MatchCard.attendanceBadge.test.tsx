import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MatchCard from "../MatchCard";
import type { NormalizedMatch } from "../../types";
import type { EventAttendanceSummaryDto } from "../../../../../services/eventAttendanceSummaryService";

function baseMatch(overrides: Partial<NormalizedMatch> = {}): NormalizedMatch {
  return {
    date: "2026-09-01",
    time: "18:00",
    localTeamName: "Team A",
    localTeamShield: "",
    localGoals: null,
    visitorTeamName: "Team B",
    visitorTeamShield: "",
    visitorGoals: null,
    isFinished: false,
    isHomeTeam: true,
    field: "Field 1",
    codacta: null,
    selectedKitNumber: null,
    locationMapUrl: null,
    ...overrides,
  };
}

function baseSummary(overrides: Partial<EventAttendanceSummaryDto> = {}): EventAttendanceSummaryDto {
  return {
    eventId: "e1",
    convocados: 10,
    going: 7,
    pending: 2,
    notGoing: 1,
    attendancePercentage: 70,
    myStatus: null,
    myStatusId: null,
    ...overrides,
  };
}

function renderCard(
  match: NormalizedMatch,
  attendanceSummary?: EventAttendanceSummaryDto,
  isPlayer = false
) {
  return render(
    <MemoryRouter>
      <MatchCard
        match={match}
        onNavigate={() => {}}
        attendanceSummary={attendanceSummary}
        isPlayer={isPlayer}
      />
    </MemoryRouter>
  );
}

describe("MatchCard - attendance badge", () => {
  it("renders the badge when match has eventId and attendanceSummary is provided", () => {
    const match = baseMatch({ eventId: "e1" });
    const summary = baseSummary();

    renderCard(match, summary, false);

    // Coach view should show attendance counts
    expect(screen.getByText(/Convocados.*10/i)).toBeInTheDocument();
  });

  it("renders no badge when match has no eventId, even if attendanceSummary is provided", () => {
    const match = baseMatch({ eventId: undefined });
    const summary = baseSummary();

    renderCard(match, summary, false);

    // Should not render the badge because eventId is not set
    expect(screen.queryByText(/Convocados/i)).not.toBeInTheDocument();
  });
});
