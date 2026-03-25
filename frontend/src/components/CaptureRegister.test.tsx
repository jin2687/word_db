import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CaptureRegister from "./CaptureRegister";
import * as api from "../api/client";

// Mock CSS import
vi.mock("./CaptureRegister.css", () => ({}));

// Mock API module
vi.mock("../api/client", () => ({
  uploadImage: vi.fn(),
  translateWord: vi.fn(),
  createCard: vi.fn(),
}));

const mockUploadImage = vi.mocked(api.uploadImage);
const mockTranslateWord = vi.mocked(api.translateWord);
const mockCreateCard = vi.mocked(api.createCard);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CaptureRegister", () => {
  it("renders camera button", () => {
    render(<CaptureRegister />);
    expect(screen.getByText(/カメラで撮影/)).toBeDefined();
  });

  it("shows extracted words after image capture", async () => {
    mockUploadImage.mockResolvedValueOnce("Hello World Test");

    render(<CaptureRegister />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "photo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeDefined();
      expect(screen.getByText("World")).toBeDefined();
      expect(screen.getByText("Test")).toBeDefined();
    });
  });

  it("translates a word when tapped", async () => {
    mockUploadImage.mockResolvedValueOnce("apple banana");
    mockTranslateWord.mockResolvedValueOnce({
      word: "apple",
      translation: "りんご",
      example: "I ate an apple.",
    });

    render(<CaptureRegister />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "p.png", { type: "image/png" })] },
    });

    await waitFor(() => expect(screen.getByText("apple")).toBeDefined());

    fireEvent.click(screen.getByText("apple"));

    await waitFor(() => {
      expect(screen.getByText("りんご")).toBeDefined();
      expect(screen.getByText(/I ate an apple/)).toBeDefined();
    });
  });

  it("registers a card successfully", async () => {
    mockUploadImage.mockResolvedValueOnce("apple");
    mockTranslateWord.mockResolvedValueOnce({
      word: "apple",
      translation: "りんご",
      example: "I ate an apple.",
    });
    mockCreateCard.mockResolvedValueOnce(undefined);

    render(<CaptureRegister />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "p.png", { type: "image/png" })] },
    });

    await waitFor(() => expect(screen.getByText("apple")).toBeDefined());
    fireEvent.click(screen.getByText("apple"));

    await waitFor(() => expect(screen.getByText("カードを登録")).toBeDefined());
    fireEvent.click(screen.getByText("カードを登録"));

    await waitFor(() => {
      expect(screen.getByText(/Anki に登録しました/)).toBeDefined();
    });
  });
});
