import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RedirectKeepingSearch from "../RedirectKeepingSearch";

function LocationProbe() {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}`}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/coach/rival-stats" element={<RedirectKeepingSearch to="/coach/match-forecast" />} />
        <Route
          path="/coach/rival-stats/simulation"
          element={<RedirectKeepingSearch to="/coach/match-forecast/simulation" />}
        />
        <Route path="/coach/match-forecast" element={<LocationProbe />} />
        <Route path="/coach/match-forecast/simulation" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RedirectKeepingSearch", () => {
  it("redirige /coach/rival-stats a /coach/match-forecast conservando la búsqueda", async () => {
    renderAt("/coach/rival-stats?teamId=abc");

    expect(await screen.findByText("/coach/match-forecast?teamId=abc")).toBeInTheDocument();
  });

  it("redirige /coach/rival-stats/simulation a /coach/match-forecast/simulation conservando la búsqueda", async () => {
    renderAt("/coach/rival-stats/simulation?teamId=abc");

    expect(await screen.findByText("/coach/match-forecast/simulation?teamId=abc")).toBeInTheDocument();
  });
});
