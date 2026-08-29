import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FileImagePicker from "../FileImagePicker";

function makeDataTransfer(files: File[]) {
  return {
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: "file",
        type: file.type,
        getAsFile: () => file,
      })),
      types: ["Files"],
    },
  };
}

describe("FileImagePicker", () => {
  it("selecciona un archivo al usar el input de tipo file (click-to-browse)", async () => {
    const onChange = vi.fn();
    render(<FileImagePicker id="rival-photo" label="Escudo" onChange={onChange} />);

    const input = screen.getByLabelText(/escudo/i) as HTMLInputElement;
    const file = new File(["contenido"], "escudo.png", { type: "image/png" });
    await userEvent.upload(input, file);

    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("selecciona un archivo al arrastrarlo y soltarlo sobre la zona de drop", () => {
    const onChange = vi.fn();
    render(<FileImagePicker id="rival-photo" label="Escudo" onChange={onChange} />);

    const dropzone = screen.getByText(/o arrastra una imagen aquí/i).parentElement!;
    const file = new File(["contenido"], "escudo.png", { type: "image/png" });

    fireEvent.drop(dropzone, makeDataTransfer([file]));

    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("resalta la zona de drop mientras se arrastra un archivo encima", () => {
    render(<FileImagePicker id="rival-photo" label="Escudo" onChange={vi.fn()} />);

    const dropzone = screen.getByText(/o arrastra una imagen aquí/i).parentElement!;
    const file = new File(["contenido"], "escudo.png", { type: "image/png" });

    fireEvent.dragEnter(dropzone, makeDataTransfer([file]));
    expect(dropzone.className).toMatch(/dropzoneActive/);

    fireEvent.dragLeave(dropzone, makeDataTransfer([file]));
    expect(dropzone.className).not.toMatch(/dropzoneActive/);
  });

  it("no invoca onChange al soltar sobre la zona sin ningún archivo", () => {
    const onChange = vi.fn();
    render(<FileImagePicker id="rival-photo" label="Escudo" onChange={onChange} />);

    const dropzone = screen.getByText(/o arrastra una imagen aquí/i).parentElement!;
    fireEvent.drop(dropzone, makeDataTransfer([]));

    expect(onChange).not.toHaveBeenCalled();
  });
});
