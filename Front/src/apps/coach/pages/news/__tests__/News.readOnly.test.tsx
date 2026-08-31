import React from "react";
import { render, screen } from "@testing-library/react";
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
    hasRole: vi.fn(() => false),
  },
}));

vi.mock("../../../hooks/useTeamDashboardBack", () => ({
  default: () => vi.fn(),
}));

import newsService from "../../../services/newsService";

describe("News page — read-only role (Player/FamilyMember)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(newsService.getNews).mockResolvedValue([
      {
        id: "n1",
        title: "Noticia publicada",
        subtitle: "Sub",
        coverImageUrl: "",
        status: "Published",
        publishedAt: "2026-08-01T00:00:00Z",
        newsDate: "2026-08-01T00:00:00Z",
      },
    ]);
  });

  it("shows the published list", async () => {
    render(
      <MemoryRouter>
        <News />
      </MemoryRouter>
    );
    expect(await screen.findByText("Noticia publicada")).toBeInTheDocument();
  });

  it("does not show the Nueva noticia button", async () => {
    render(
      <MemoryRouter>
        <News />
      </MemoryRouter>
    );
    await screen.findByText("Noticia publicada");
    expect(screen.queryByRole("button", { name: /nueva noticia/i })).not.toBeInTheDocument();
  });

  it("does not show a Published/Drafts tab switcher or per-card management actions", async () => {
    render(
      <MemoryRouter>
        <News />
      </MemoryRouter>
    );
    await screen.findByText("Noticia publicada");
    expect(screen.queryByRole("tab", { name: /borradores/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publicar/i })).not.toBeInTheDocument();
  });
});
