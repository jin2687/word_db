/**
 * API client – all calls to the FastAPI backend go through here.
 *
 * In development the Vite proxy rewrites /api/* → http://localhost:8000/*.
 * In production, set VITE_API_BASE to the Tailscale URL of the backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

// ---- Types ----------------------------------------------------------------

export interface TranslateResult {
  word: string;
  translation: string;
  example: string;
}

export interface CardInfo {
  card_id: number;
  front: string;
  back: string;
}

// ---- API calls ------------------------------------------------------------

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload-image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.text as string;
}

export async function translateWord(
  word: string,
  context: string,
): Promise<TranslateResult> {
  const res = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, context }),
  });
  if (!res.ok) throw new Error("Translation failed");
  return res.json();
}

export async function createCard(
  word: string,
  translation: string,
  example: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/create-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, translation, example }),
  });
  if (!res.ok) throw new Error("Card creation failed");
}

export async function fetchDueCards(): Promise<CardInfo[]> {
  const res = await fetch(`${API_BASE}/due-cards`);
  if (!res.ok) throw new Error("Failed to fetch due cards");
  return res.json();
}

export async function answerCard(
  cardId: number,
  ease: number,
): Promise<void> {
  const res = await fetch(`${API_BASE}/answer-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_id: cardId, ease }),
  });
  if (!res.ok) throw new Error("Failed to answer card");
}
