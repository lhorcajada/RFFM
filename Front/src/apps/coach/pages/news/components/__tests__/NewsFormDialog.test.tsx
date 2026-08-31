import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NewsFormDialog from "../NewsFormDialog";

vi.mock("../../../../services/newsService", () => ({
  default: {
    createNews: vi.fn(),
    updateNews: vi.fn(),
    uploadNewsImage: vi.fn(),
  },
}));

import newsService from "../../../../services/newsService";

describe("NewsFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation errors when required fields are empty", async () => {
    render(<NewsFormDialog open onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findAllByText(/obligatori/i)).not.toHaveLength(0);
    expect(newsService.createNews).not.toHaveBeenCalled();
  });

  it("create mode calls createNews with the entered payload", async () => {
    vi.mocked(newsService.createNews).mockResolvedValue({ id: "n1" });
    const onSaved = vi.fn();

    render(<NewsFormDialog open onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText(/^título$/i), { target: { value: "Título" } });
    fireEvent.change(screen.getByLabelText(/subtítulo/i), { target: { value: "Subtítulo" } });
    fireEvent.change(screen.getByLabelText(/cuerpo|contenido/i), {
      target: { value: "Cuerpo de la noticia" },
    });
    fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: "2026-09-01" } });

    // simulate an already-uploaded cover image by uploading a file first
    vi.mocked(newsService.uploadNewsImage).mockResolvedValue("https://example.com/img.jpg");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(newsService.uploadNewsImage).toHaveBeenCalledWith(file));

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(newsService.createNews).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(newsService.createNews).mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Título",
      subtitle: "Subtítulo",
      body: "Cuerpo de la noticia",
      coverImageUrl: "https://example.com/img.jpg",
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("edit mode pre-fills fields and calls updateNews", async () => {
    vi.mocked(newsService.updateNews).mockResolvedValue(undefined);
    const onSaved = vi.fn();

    render(
      <NewsFormDialog
        open
        onClose={vi.fn()}
        onSaved={onSaved}
        initialValue={{
          id: "n1",
          title: "Original",
          subtitle: "Sub original",
          body: "Cuerpo original",
          coverImageUrl: "https://example.com/orig.jpg",
          status: "Draft",
          publishedAt: null,
          newsDate: "2026-08-20T00:00:00Z",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        }}
      />
    );

    expect(screen.getByLabelText(/^título$/i)).toHaveValue("Original");

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(newsService.updateNews).toHaveBeenCalledTimes(1));
    expect(newsService.updateNews).toHaveBeenCalledWith(
      "n1",
      expect.objectContaining({ title: "Original" })
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("selecting an image calls uploadNewsImage and populates coverImageUrl on submit", async () => {
    vi.mocked(newsService.uploadNewsImage).mockResolvedValue("https://example.com/uploaded.jpg");
    vi.mocked(newsService.createNews).mockResolvedValue({ id: "n2" });

    render(<NewsFormDialog open onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^título$/i), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText(/subtítulo/i), { target: { value: "S" } });
    fireEvent.change(screen.getByLabelText(/cuerpo|contenido/i), { target: { value: "B" } });
    fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: "2026-09-01" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(newsService.uploadNewsImage).toHaveBeenCalledWith(file));

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(newsService.createNews).toHaveBeenCalledWith(
        expect.objectContaining({ coverImageUrl: "https://example.com/uploaded.jpg" })
      )
    );
  });
});
