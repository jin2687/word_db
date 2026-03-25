import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadImage, translateWord, createCard, fetchDueCards, answerCard } from "./client";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("uploadImage", () => {
  it("sends file and returns extracted text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Hello World" }),
    });

    const file = new File(["fake"], "test.png", { type: "image/png" });
    const result = await uploadImage(file);

    expect(result).toBe("Hello World");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/upload-image");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const file = new File(["fake"], "test.png", { type: "image/png" });
    await expect(uploadImage(file)).rejects.toThrow("Image upload failed");
  });
});

describe("translateWord", () => {
  it("sends word and context, returns translation", async () => {
    const body = { word: "run", translation: "走る", example: "I run daily." };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    });

    const result = await translateWord("run", "I run daily.");

    expect(result).toEqual(body);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/translate");
    expect(JSON.parse(opts.body)).toEqual({ word: "run", context: "I run daily." });
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(translateWord("x", "y")).rejects.toThrow("Translation failed");
  });
});

describe("createCard", () => {
  it("sends card data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ note_id: 123 }),
    });

    await createCard("apple", "りんご", "I ate an apple.");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/create-card");
    expect(JSON.parse(opts.body)).toEqual({
      word: "apple",
      translation: "りんご",
      example: "I ate an apple.",
    });
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(createCard("a", "b", "c")).rejects.toThrow("Card creation failed");
  });
});

describe("fetchDueCards", () => {
  it("returns card list", async () => {
    const cards = [
      { card_id: 1, front: "<b>apple</b>", back: "<b>りんご</b>" },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => cards,
    });

    const result = await fetchDueCards();
    expect(result).toEqual(cards);
    expect(mockFetch.mock.calls[0][0]).toContain("/due-cards");
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchDueCards()).rejects.toThrow("Failed to fetch due cards");
  });
});

describe("answerCard", () => {
  it("sends card answer", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await answerCard(1001, 3);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/answer-card");
    expect(JSON.parse(opts.body)).toEqual({ card_id: 1001, ease: 3 });
  });

  it("throws on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(answerCard(1, 1)).rejects.toThrow("Failed to answer card");
  });
});
