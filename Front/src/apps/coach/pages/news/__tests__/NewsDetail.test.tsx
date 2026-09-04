import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NewsDetail from "../NewsDetail";

vi.mock("../../../../../shared/components/ui/BaseLayout/BaseLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../../../shared/components/ui/ContentLayout/ContentLayout", () => ({
  default: ({
    actionBar,
    children,
  }: {
    actionBar?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {actionBar}
      {children}
    </>
  ),
}));

vi.mock("../../../services/newsService", () => ({
  default: {
    getNewsById: vi.fn(),
  },
}));

vi.mock("../../../../../shared/services/imageService", () => ({
  fetchPublicStorageFile: vi.fn(),
}));

import newsService from "../../../services/newsService";
import { fetchPublicStorageFile } from "../../../../../shared/services/imageService";

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/coach/news/${id}`]}>
      <Routes>
        <Route path="/coach/news/:id" element={<NewsDetail />} />
        <Route path="/coach/news" element={<div>lista de noticias</div>} />
        <Route path="/coach/attendance/:eventId" element={<div>popup de convocatoria</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("NewsDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title, subtitle, body, cover image and date for a valid id", async () => {
    vi.mocked(newsService.getNewsById).mockResolvedValue({
      id: "n1",
      title: "Título de la noticia",
      subtitle: "Subtítulo",
      body: "Cuerpo completo",
      coverImageUrl: "newsimages/img.jpg",
      status: "Published",
      publishedAt: "2026-08-01T00:00:00Z",
      newsDate: "2026-08-01T00:00:00Z",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    });
    vi.mocked(fetchPublicStorageFile).mockResolvedValue("blob:mock-url");

    renderAt("n1");

    expect(await screen.findByText("Cuerpo completo")).toBeInTheDocument();
    const img = await screen.findByAltText("Título de la noticia");
    expect(img).toHaveAttribute("src", "blob:mock-url");
    expect(fetchPublicStorageFile).toHaveBeenCalledWith("newsimages/img.jpg");
  });

  it("shows a not-found state when getNewsById resolves null", async () => {
    vi.mocked(newsService.getNewsById).mockResolvedValue(null);

    renderAt("missing");

    expect(await screen.findByText(/no encontrada/i)).toBeInTheDocument();
  });

  it('"Volver a noticias" navigates to /coach/news', async () => {
    vi.mocked(newsService.getNewsById).mockResolvedValue({
      id: "n1",
      title: "Título",
      subtitle: "Sub",
      body: "Cuerpo",
      coverImageUrl: "",
      status: "Published",
      publishedAt: "2026-08-01T00:00:00Z",
      newsDate: "2026-08-01T00:00:00Z",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      linkType: "None",
      linkedEventId: null,
      linkedTeamId: null,
      linkUrl: null,
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    renderAt("n1");

    await screen.findByText("Cuerpo");
    await userEvent.click(screen.getByRole("button", { name: /volver a noticias/i }));

    expect(await screen.findByText("lista de noticias")).toBeInTheDocument();
  });

  it("renders 'Ver convocatoria' button for MatchConvocation link type", async () => {
    vi.mocked(newsService.getNewsById).mockResolvedValue({
      id: "n1",
      title: "Título",
      subtitle: "Sub",
      body: "Cuerpo",
      coverImageUrl: "",
      status: "Published",
      publishedAt: "2026-08-01T00:00:00Z",
      newsDate: "2026-08-01T00:00:00Z",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      linkType: "MatchConvocation",
      linkedEventId: "event-123",
      linkedTeamId: "team-456",
      linkUrl: null,
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    renderAt("n1");

    const button = await screen.findByRole("button", { name: /ver convocatoria/i });
    await userEvent.click(button);

    expect(await screen.findByText("popup de convocatoria")).toBeInTheDocument();
  });

  it("renders external link for External link type", async () => {
    vi.mocked(newsService.getNewsById).mockResolvedValue({
      id: "n1",
      title: "Título",
      subtitle: "Sub",
      body: "Cuerpo",
      coverImageUrl: "",
      status: "Published",
      publishedAt: "2026-08-01T00:00:00Z",
      newsDate: "2026-08-01T00:00:00Z",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      linkType: "External",
      linkedEventId: null,
      linkedTeamId: null,
      linkUrl: "https://maps.google.com/place/abc",
    });

    renderAt("n1");

    const link = await screen.findByRole("link", { name: /ver enlace/i });
    expect(link).toHaveAttribute("href", "https://maps.google.com/place/abc");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not render link buttons for None link type", async () => {
    vi.mocked(newsService.getNewsById).mockResolvedValue({
      id: "n1",
      title: "Título",
      subtitle: "Sub",
      body: "Cuerpo",
      coverImageUrl: "",
      status: "Published",
      publishedAt: "2026-08-01T00:00:00Z",
      newsDate: "2026-08-01T00:00:00Z",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
      linkType: "None",
      linkedEventId: null,
      linkedTeamId: null,
      linkUrl: null,
    });

    renderAt("n1");

    await screen.findByText("Cuerpo");
    expect(screen.queryByRole("button", { name: /ver convocatoria/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ver enlace/i })).not.toBeInTheDocument();
  });
});
