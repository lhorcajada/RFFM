import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import News from "../News";

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
    getNews: vi.fn(),
    getNewsDrafts: vi.fn(),
    getNewsById: vi.fn(),
    createNews: vi.fn(),
    updateNews: vi.fn(),
    deleteNews: vi.fn(),
    publishNews: vi.fn(),
    unpublishNews: vi.fn(),
    uploadNewsImage: vi.fn(),
  },
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    hasRole: vi.fn((role: string) => role === "Coach"),
  },
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

import newsService from "../../../services/newsService";

const publishedItem = {
  id: "n1",
  title: "Noticia publicada",
  subtitle: "Sub",
  coverImageUrl: "",
  status: "Published" as const,
  publishedAt: "2026-08-01T00:00:00Z",
  newsDate: "2026-08-01T00:00:00Z",
};

const draftItem = {
  id: "n2",
  title: "Borrador",
  subtitle: "Sub borrador",
  coverImageUrl: "",
  status: "Draft" as const,
  publishedAt: null,
  newsDate: "2026-08-02T00:00:00Z",
};

describe("News page — Coach/Administrator management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(newsService.getNews).mockResolvedValue([publishedItem]);
    vi.mocked(newsService.getNewsDrafts).mockResolvedValue([draftItem]);
  });

  it("shows the Nueva noticia button and a Published/Drafts tab switcher", async () => {
    render(
      <MemoryRouter>
        <News />
      </MemoryRouter>
    );
    await screen.findByText("Noticia publicada");
    expect(screen.getByRole("button", { name: /nueva noticia/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /publicadas/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /borradores/i })).toBeInTheDocument();
  });

  it("shows per-card Editar/Publicar-or-Despublicar/Eliminar actions matching status", async () => {
    render(
      <MemoryRouter>
        <News />
      </MemoryRouter>
    );
    await screen.findByText("Noticia publicada");
    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /despublicar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeInTheDocument();
  });

  it("switching to the Borradores tab shows draft items with a Publicar action", async () => {
    render(
      <MemoryRouter>
        <News />
      </MemoryRouter>
    );
    await screen.findByText("Noticia publicada");
    fireEvent.click(screen.getByRole("tab", { name: /borradores/i }));

    expect(await screen.findByText("Borrador")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^publicar$/i })).toBeInTheDocument();
  });

  it("deleting a news item opens a confirmation dialog and calls deleteNews on confirm", async () => {
    vi.mocked(newsService.deleteNews).mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <News />
      </MemoryRouter>
    );
    await screen.findByText("Noticia publicada");

    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    expect(await screen.findByText(/¿desea eliminar|eliminar la noticia/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => expect(newsService.deleteNews).toHaveBeenCalledWith("n1"));
  });
});
