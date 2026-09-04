import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NewsListCard from "../NewsListCard";
import type { NewsSummaryDto } from "../../../../services/newsService";

vi.mock("../../../../../../shared/services/imageService", () => ({
  fetchPublicStorageFile: vi.fn(),
}));

import { fetchPublicStorageFile } from "../../../../../../shared/services/imageService";

const item: NewsSummaryDto = {
  id: "n1",
  title: "Nueva convocatoria",
  subtitle: "Detalles del próximo partido",
  coverImageUrl: "newsimages/cover.jpg",
  status: "Published",
  publishedAt: "2026-08-20T10:00:00Z",
  newsDate: "2026-08-20T00:00:00Z",
  linkType: "None",
  linkedEventId: null,
  linkedTeamId: null,
  linkUrl: null,
};

function renderCard(overrides: Partial<NewsSummaryDto> = {}) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<NewsListCard item={{ ...item, ...overrides }} />} />
        <Route path="/coach/news/:id" element={<div>detalle de noticia</div>} />
        <Route path="/coach/attendance/:id" element={<div>popup de convocatoria</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("NewsListCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title, subtitle and formatted date", () => {
    vi.mocked(fetchPublicStorageFile).mockResolvedValue("blob:mock-url");
    renderCard();
    expect(screen.getByText("Nueva convocatoria")).toBeInTheDocument();
    expect(screen.getByText("Detalles del próximo partido")).toBeInTheDocument();
  });

  it("resolves the cover image through the public storage endpoint instead of using the raw stored path directly", async () => {
    vi.mocked(fetchPublicStorageFile).mockResolvedValue("blob:mock-url");
    renderCard();

    const img = await screen.findByAltText("Nueva convocatoria");
    expect(img).toHaveAttribute("src", "blob:mock-url");
    expect(fetchPublicStorageFile).toHaveBeenCalledWith("newsimages/cover.jpg");
  });

  it("renders no image when coverImageUrl is empty", () => {
    renderCard({ coverImageUrl: "" });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(fetchPublicStorageFile).not.toHaveBeenCalled();
  });

  it("links to the news detail route", () => {
    vi.mocked(fetchPublicStorageFile).mockResolvedValue("blob:mock-url");
    renderCard();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/coach/news/n1");
  });

  it("renders a badge when linkType is MatchConvocation", () => {
    renderCard({
      linkType: "MatchConvocation",
      linkedEventId: "event-123",
      linkedTeamId: "team-456",
    });
    expect(screen.getByText("Convocatoria")).toBeInTheDocument();
  });

  it("clicking the MatchConvocation badge opens the convocation popup (coach/attendance) instead of the news detail, and does not navigate to the news detail too", () => {
    renderCard({
      linkType: "MatchConvocation",
      linkedEventId: "event-123",
      linkedTeamId: "team-456",
    });

    fireEvent.click(screen.getByText("Convocatoria"));

    expect(screen.getByText("popup de convocatoria")).toBeInTheDocument();
    expect(screen.queryByText("detalle de noticia")).not.toBeInTheDocument();
  });

  it("renders a badge when linkType is External", () => {
    renderCard({
      linkType: "External",
      linkUrl: "https://maps.google.com/abc",
    });
    expect(screen.getByText("Enlace")).toBeInTheDocument();
  });

  it("does not render a badge when linkType is None", () => {
    renderCard({
      linkType: "None",
      title: "Sin enlace asociado",
    });
    expect(screen.queryByText("Convocatoria")).not.toBeInTheDocument();
    expect(screen.queryByText("Enlace")).not.toBeInTheDocument();
  });
});
