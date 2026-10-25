import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import OwnMatchCard from "../OwnMatchCard";
import { calendarMatch } from "../../__tests__/fixtures";

function renderCard(props: Partial<React.ComponentProps<typeof OwnMatchCard>> = {}) {
  return render(
    <MemoryRouter>
      <OwnMatchCard match={calendarMatch()} bye={false} teamCode="100" isCurrentRound={false} actaLink={null} {...props} />
    </MemoryRouter>,
  );
}

describe("OwnMatchCard", () => {
  it("muestra «Tu partido» con ambos equipos, fecha, hora y campo", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: "Tu partido" })).toBeInTheDocument();
    expect(screen.getByText("Mi Equipo")).toBeInTheDocument();
    expect(screen.getByText("Rival UD")).toBeInTheDocument();
    expect(screen.getByText("Dom 4 oct · 11:00")).toBeInTheDocument();
    expect(screen.getByText("Campo Municipal")).toBeInTheDocument();
  });

  it("muestra el marcador y la derrota como local", () => {
    renderCard({ match: calendarMatch({ localGoals: "1", visitorGoals: "3" }) });

    expect(screen.getByText("Finalizado")).toBeInTheDocument();
    expect(screen.getByLabelText("Marcador 1 a 3")).toBeInTheDocument();
    expect(screen.getByText("Derrota 1–3")).toBeInTheDocument();
  });

  it("muestra la victoria desde el punto de vista del equipo visitante", () => {
    renderCard({ match: calendarMatch({ localTeamCode: "200", visitorTeamCode: "100", localGoals: "0", visitorGoals: "2" }) });

    expect(screen.getByText("Victoria 2–0")).toBeInTheDocument();
  });

  it("muestra la hora y no el resultado si no se ha jugado", () => {
    renderCard({ isCurrentRound: true });

    expect(screen.getByText("Próximo")).toBeInTheDocument();
    expect(screen.getByText("vs")).toBeInTheDocument();
    expect(screen.queryByText(/Victoria|Empate|Derrota/)).not.toBeInTheDocument();
  });

  it("marca «Programado» un partido sin jugar fuera de la jornada actual", () => {
    renderCard();

    expect(screen.getByText("Programado")).toBeInTheDocument();
  });

  it("enlaza «Ver acta» cuando hay enlace", () => {
    renderCard({ actaLink: "/coach/match-report?eventId=e1&teamId=t1" });

    expect(screen.getByRole("link", { name: "Ver acta" })).toHaveAttribute("href", "/coach/match-report?eventId=e1&teamId=t1");
  });

  it("muestra el escudo de ambos equipos", () => {
    renderCard({ match: calendarMatch({ localTeamImageUrl: "/escudos/mi.png", visitorTeamImageUrl: "https://cdn.example.com/rival.png" }) });

    expect(screen.getByRole("img", { name: "Escudo de Mi Equipo" })).toHaveAttribute("src", "https://www.rffm.es/escudos/mi.png");
    expect(screen.getByRole("img", { name: "Escudo de Rival UD" })).toHaveAttribute("src", "https://cdn.example.com/rival.png");
  });

  it("marca «Suspendido» un partido suspendido y no muestra resultado", () => {
    renderCard({ match: calendarMatch({ status: "3", localGoals: "1", visitorGoals: "0" }), isCurrentRound: true });

    expect(screen.getByText("Suspendido")).toBeInTheDocument();
    expect(screen.queryByText("Próximo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Victoria|Empate|Derrota/)).not.toBeInTheDocument();
  });

  it("indica «Descansa» cuando el equipo descansa", () => {
    renderCard({ match: null, bye: true });

    expect(screen.getByRole("heading", { name: "Tu partido" })).toBeInTheDocument();
    expect(screen.getByText("Descansa")).toBeInTheDocument();
  });
});
