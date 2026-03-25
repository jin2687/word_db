import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Review from "./Review";
import * as api from "../api/client";

// Mock CSS import
vi.mock("./Review.css", () => ({}));

// Mock API module
vi.mock("../api/client", () => ({
  fetchDueCards: vi.fn(),
  answerCard: vi.fn(),
}));

const mockFetchDueCards = vi.mocked(api.fetchDueCards);
const mockAnswerCard = vi.mocked(api.answerCard);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Review", () => {
  it("shows loading state initially", () => {
    mockFetchDueCards.mockReturnValue(new Promise(() => {})); // never resolves
    render(<Review />);
    expect(screen.getByText("読み込み中…")).toBeDefined();
  });

  it("shows completion message when no due cards", async () => {
    mockFetchDueCards.mockResolvedValueOnce([]);
    render(<Review />);

    await waitFor(() => {
      expect(screen.getByText(/お疲れさまでした/)).toBeDefined();
      expect(screen.getByText("今日の復習は完了です。")).toBeDefined();
    });
  });

  it("displays flashcard front and allows revealing back", async () => {
    mockFetchDueCards.mockResolvedValueOnce([
      { card_id: 1, front: "<b>apple</b>", back: "<b>りんご</b>" },
    ]);

    render(<Review />);

    await waitFor(() => {
      expect(screen.getByText("答えを見る")).toBeDefined();
    });

    // Front should be shown
    expect(screen.getByText("1 / 1")).toBeDefined();

    // Click to reveal back
    fireEvent.click(screen.getByText("答えを見る"));

    await waitFor(() => {
      expect(screen.getByText("忘れた")).toBeDefined();
      expect(screen.getByText("覚えた")).toBeDefined();
    });
  });

  it("answers card and moves to next or finishes", async () => {
    mockFetchDueCards.mockResolvedValueOnce([
      { card_id: 1, front: "<b>apple</b>", back: "<b>りんご</b>" },
      { card_id: 2, front: "<b>run</b>", back: "<b>走る</b>" },
    ]);
    mockAnswerCard.mockResolvedValue(undefined);

    render(<Review />);

    await waitFor(() => expect(screen.getByText("答えを見る")).toBeDefined());
    expect(screen.getByText("1 / 2")).toBeDefined();

    // Reveal & answer "Good"
    fireEvent.click(screen.getByText("答えを見る"));
    await waitFor(() => expect(screen.getByText("覚えた")).toBeDefined());
    fireEvent.click(screen.getByText("覚えた"));

    // Should move to card 2
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeDefined());

    // Reveal & answer "Again"
    fireEvent.click(screen.getByText("答えを見る"));
    await waitFor(() => expect(screen.getByText("忘れた")).toBeDefined());
    fireEvent.click(screen.getByText("忘れた"));

    // Should show completion
    await waitFor(() => {
      expect(screen.getByText(/お疲れさまでした/)).toBeDefined();
    });

    expect(mockAnswerCard).toHaveBeenCalledTimes(2);
    expect(mockAnswerCard).toHaveBeenCalledWith(1, 3); // Good
    expect(mockAnswerCard).toHaveBeenCalledWith(2, 1); // Again
  });

  it("reload button fetches cards again", async () => {
    mockFetchDueCards.mockResolvedValueOnce([]);
    render(<Review />);

    await waitFor(() => expect(screen.getByText("もう一度チェック")).toBeDefined());

    mockFetchDueCards.mockResolvedValueOnce([
      { card_id: 3, front: "<b>cat</b>", back: "<b>猫</b>" },
    ]);
    fireEvent.click(screen.getByText("もう一度チェック"));

    await waitFor(() => expect(screen.getByText("答えを見る")).toBeDefined());
  });
});
