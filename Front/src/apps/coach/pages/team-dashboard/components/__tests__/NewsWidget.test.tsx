import { render, screen, fireEvent, act } from "@testing-library/react";
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

const threeItems = [
  {
    id: "n1",
    title: "Noticia 1",
    subtitle: "Sub 1",
    coverImageUrl: "",
    status: "Published" as const,
    publishedAt: "2026-08-03T00:00:00Z",
    newsDate: "2026-08-03T00:00:00Z",
  },
  {
    id: "n2",
    title: "Noticia 2",
    subtitle: "Sub 2",
    coverImageUrl: "",
    status: "Published" as const,
    publishedAt: "2026-08-02T00:00:00Z",
    newsDate: "2026-08-02T00:00:00Z",
  },
  {
    id: "n3",
    title: "Noticia 3",
    subtitle: "Sub 3",
    coverImageUrl: "",
    status: "Published" as const,
    publishedAt: "2026-08-01T00:00:00Z",
    newsDate: "2026-08-01T00:00:00Z",
  },
];

describe("NewsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders up to 3 published news items", async () => {
    vi.mocked(newsService.getNews).mockResolvedValue([
      {
        id: "n1",
        title: "Noticia 1",
        subtitle: "Sub 1",
        coverImageUrl: "",
        status: "Published",
        publishedAt: "2026-08-03T00:00:00Z",
        newsDate: "2026-08-03T00:00:00Z",
      },
      {
        id: "n2",
        title: "Noticia 2",
        subtitle: "Sub 2",
        coverImageUrl: "",
        status: "Published",
        publishedAt: "2026-08-02T00:00:00Z",
        newsDate: "2026-08-02T00:00:00Z",
      },
    ]);

    renderWidget();

    expect(await screen.findByText("Noticia 1")).toBeInTheDocument();
    expect(screen.getByText("Noticia 2")).toBeInTheDocument();
    expect(newsService.getNews).toHaveBeenCalledWith(1, 3, true);
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

  it("advances automatically to the next item after the auto-advance interval", async () => {
    vi.mocked(newsService.getNews).mockResolvedValue(threeItems);
    vi.useFakeTimers();

    renderWidget();
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    let dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[0]).toHaveAttribute("aria-current", "true");

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("manual navigation (Siguiente arrow) moves to the next item and pauses auto-advance", async () => {
    vi.mocked(newsService.getNews).mockResolvedValue(threeItems);
    vi.useFakeTimers();

    renderWidget();
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    let dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");

    // Auto-advance is paused right after manual interaction.
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });
});
