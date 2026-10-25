import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RoundMatchList from "../RoundMatchList";
import { calendarMatch } from "../../__tests__/fixtures";

const played = calendarMatch({
  matchRecordCode: "p",
  localTeamName: "Local A",
  localTeamImageUrl: "https://cdn.example.com/local-a.png",
  visitorTeamName: "Visitante A",
  visitorTeamImageUrl: "/escudos/visitante-a.png",
  localGoals: "2",
  visitorGoals: "0",
});
const upcoming = calendarMatch({ matchRecordCode: "u", localTeamName: "Local B", visitorTeamName: "Visitante B", time: "17:30" });

function renderList(resolveActaLink = (cod: string) => (cod ? `/acta/${cod}` : null)) {
  return render(
    <MemoryRouter>
      <RoundMatchList title="Resto de la jornada" matches={[played, upcoming]} resolveActaLink={resolveActaLink} />
    </MemoryRouter>,
  );
}

describe("RoundMatchList", () => {
  it("muestra el título y una tarjeta por partido", () => {
    renderList();

    expect(screen.getByRole("heading", { name: "Resto de la jornada" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("muestra el marcador de un partido jugado y la hora de uno pendiente", () => {
    renderList();

    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByText("Local A")).toBeInTheDocument();
    expect(within(first).getByText("2 – 0")).toBeInTheDocument();
    expect(within(second).getByText("17:30")).toBeInTheDocument();
  });

  it("muestra el escudo de ambos equipos", () => {
    renderList();

    const [first] = screen.getAllByRole("listitem");
    expect(within(first).getByRole("img", { name: "Escudo de Local A" })).toHaveAttribute("src", "https://cdn.example.com/local-a.png");
    expect(within(first).getByRole("img", { name: "Escudo de Visitante A" })).toHaveAttribute(
      "src",
      "https://www.rffm.es/escudos/visitante-a.png",
    );
  });

  it("enlaza «Ver acta» en cada partido con enlace", () => {
    renderList();

    const links = screen.getAllByRole("link", { name: "Ver acta" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/acta/p");
  });

  it("no muestra «Ver acta» si no hay enlace", () => {
    renderList(() => null);

    expect(screen.queryByRole("link", { name: "Ver acta" })).not.toBeInTheDocument();
  });

  it("muestra la etiqueta «Suspendido» en los partidos suspendidos", () => {
    render(
      <MemoryRouter>
        <RoundMatchList
          title="Resto de la jornada"
          matches={[upcoming, calendarMatch({ matchRecordCode: "s", localTeamName: "Local S", status: "3" })]}
          resolveActaLink={() => null}
        />
      </MemoryRouter>,
    );

    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).queryByText("Suspendido")).not.toBeInTheDocument();
    expect(within(second).getByText("Suspendido")).toBeInTheDocument();
  });

  it("no usa tablas", () => {
    renderList();

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
