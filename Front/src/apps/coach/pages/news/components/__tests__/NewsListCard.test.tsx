import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
};

function renderCard(overrides: Partial<NewsSummaryDto> = {}) {
  return render(
    <MemoryRouter>
      <NewsListCard item={{ ...item, ...overrides }} />
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
});
