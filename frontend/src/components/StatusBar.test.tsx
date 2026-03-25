import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import StatusBar from "./StatusBar";
import * as api from "../api/client";

vi.mock("./StatusBar.css", () => ({}));

vi.mock("../api/client", () => ({
  checkHealth: vi.fn(),
}));

const mockCheckHealth = vi.mocked(api.checkHealth);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("StatusBar", () => {
  it("shows green indicators when all services are up", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      api: true,
      ollama: true,
      anki: true,
      ollama_models: ["llava", "llama3"],
    });

    const { container } = render(<StatusBar />);

    await waitFor(() => {
      const bar = container.querySelector(".status-bar");
      expect(bar).not.toBeNull();
      expect(bar?.classList.contains("ok")).toBe(true);
      expect(bar?.textContent).toContain("API");
      expect(bar?.textContent).toContain("Ollama");
      expect(bar?.textContent).toContain("Anki");
    });
  });

  it("shows warning state when a service is down", async () => {
    mockCheckHealth.mockResolvedValueOnce({
      api: true,
      ollama: false,
      anki: true,
      ollama_models: [],
    });

    const { container } = render(<StatusBar />);

    await waitFor(() => {
      const bar = container.querySelector(".status-bar");
      expect(bar?.classList.contains("warn")).toBe(true);
    });
  });

  it("renders nothing while loading", () => {
    mockCheckHealth.mockReturnValue(new Promise(() => {}));
    const { container } = render(<StatusBar />);
    expect(container.querySelector(".status-bar")).toBeNull();
  });
});
