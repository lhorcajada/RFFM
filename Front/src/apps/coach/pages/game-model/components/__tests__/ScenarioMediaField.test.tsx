import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ScenarioMediaField from "../ScenarioMediaField";
import gameModelService from "../../../../services/gameModelService";

vi.mock("../../../../services/gameModelService", () => ({
  default: {
    uploadScenarioMedia: vi.fn(),
    deleteScenarioMedia: vi.fn(),
  },
}));

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const file = new File(["x".repeat(sizeBytes)], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

describe("ScenarioMediaField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el botón de subir cuando no hay media", () => {
    render(
      <ScenarioMediaField scenarioApiId="scenario-1" mediaUrl={null} mediaType={null} onChange={vi.fn()} />
    );
    expect(screen.getByText(/subir imagen.*v[ií]deo/i)).toBeInTheDocument();
  });

  it("sube una imagen válida y llama al servicio", async () => {
    const onChange = vi.fn();
    vi.mocked(gameModelService.uploadScenarioMedia).mockResolvedValue({
      url: "https://example.com/img.jpg",
      mediaType: "image",
    });

    render(
      <ScenarioMediaField scenarioApiId="scenario-1" mediaUrl={null} mediaType={null} onChange={onChange} />
    );

    const file = makeFile("photo.jpg", "image/jpeg");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(gameModelService.uploadScenarioMedia).toHaveBeenCalledWith("scenario-1", file);
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("https://example.com/img.jpg", "image");
    });
  });

  it("rechaza un vídeo que excede la duración/resolución sin llamar al servicio", async () => {
    const onChange = vi.fn();

    Object.defineProperty(HTMLMediaElement.prototype, "duration", {
      configurable: true,
      get() {
        return 15;
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "videoWidth", {
      configurable: true,
      get() {
        return 1280;
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "videoHeight", {
      configurable: true,
      get() {
        return 720;
      },
    });

    render(
      <ScenarioMediaField scenarioApiId="scenario-1" mediaUrl={null} mediaType={null} onChange={onChange} />
    );

    const file = makeFile("clip.mp4", "video/mp4");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // jsdom does not decode real video; manually fire loadedmetadata on any
    // <video> element created by the component to read metadata.
    await waitFor(() => {
      const videoEls = document.querySelectorAll("video");
      expect(videoEls.length).toBeGreaterThan(0);
    });
    const hiddenVideo = document.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedMetadata(hiddenVideo);

    await waitFor(() => {
      expect(screen.getByText(/no puede durar más de 10 segundos/i)).toBeInTheDocument();
    });
    expect(gameModelService.uploadScenarioMedia).not.toHaveBeenCalled();
  });

  it("con media existente, muestra preview y botón Quitar que borra", async () => {
    const onChange = vi.fn();
    vi.mocked(gameModelService.deleteScenarioMedia).mockResolvedValue(undefined);

    render(
      <ScenarioMediaField
        scenarioApiId="scenario-1"
        mediaUrl="https://example.com/img.jpg"
        mediaType="image"
        onChange={onChange}
      />
    );

    expect(screen.getByAltText(/vista previa/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /quitar/i }));

    await waitFor(() => {
      expect(gameModelService.deleteScenarioMedia).toHaveBeenCalledWith("scenario-1");
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null, null);
    });
  });
});
