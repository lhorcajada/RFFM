import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import NewsWidget from "../NewsWidget";

vi.mock("../../../../services/newsService", () => ({
  default: {
    getNews: vi.fn(),
  },
}));

import newsService from "../../../../services/newsService";

function renderWidget() {
  return render(
    <MemoryRouter>
      <NewsWidget />
    </MemoryRouter>
  );
}

function newsItem(id: string, title: string, publishedAt: string) {
  return {
    id,
    title,
    subtitle: `Sub ${id}`,
    body: `Cuerpo ${id}`,
    coverImageUrl: "",
    status: "Published" as const,
    publishedAt,
    newsDate: publishedAt,
    linkType: "None" as const,
    linkedEventId: null,
    linkedTeamId: null,
    linkUrl: null,
  };
}

const threeItems = [
  newsItem("n1", "Noticia 1", "2026-08-03T10:00:00Z"),
  newsItem("n2", "Noticia 2", "2026-08-02T10:00:00Z"),
  newsItem("n3", "Noticia 3", "2026-08-01T10:00:00Z"),
];

describe("NewsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("muestra las tres noticias publicadas a la vez, sin carrusel", async () => {
    vi.mocked(newsService.getNews).mockResolvedValue(threeItems);

    renderWidget();

    const list = await screen.findByRole("list", { name: "Noticias" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(newsService.getNews).toHaveBeenCalledWith(1, 3, true);
    expect(screen.queryByRole("button", { name: /siguiente/i })).not.toBeInTheDocument();
  });

  it("enlaza cada noticia a su detalle y muestra su antigüedad", async () => {
    vi.mocked(newsService.getNews).mockResolvedValue(threeItems);

    renderWidget();

    const link = await screen.findByRole("link", { name: /Noticia 1/ });
    expect(link).toHaveAttribute("href", "/coach/news/n1");
    expect(link).toHaveTextContent("Hace 2 días");
  });

  it("enlaza «Ver todas» a la lista de noticias", async () => {
    vi.mocked(newsService.getNews).mockResolvedValue(threeItems);
    renderWidget();
    expect(await screen.findByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/coach/news");
  });

  it("shows an empty state when there are no published news", async () => {
    vi.mocked(newsService.getNews).mockResolvedValue([]);
    renderWidget();
    expect(await screen.findByText(/no hay noticias/i)).toBeInTheDocument();
  });

  it("shows a loading state while fetching", () => {
    vi.mocked(newsService.getNews).mockImplementation(() => new Promise(() => {}));
    renderWidget();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
