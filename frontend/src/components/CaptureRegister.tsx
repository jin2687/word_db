import { useRef, useState } from "react";
import { uploadImage, translateWord, createCard, TranslateResult } from "../api/client";
import "./CaptureRegister.css";

export default function CaptureRegister() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [translation, setTranslation] = useState<TranslateResult | null>(null);
  const [registered, setRegistered] = useState(false);

  // ---- Step 1: Capture & OCR ------------------------------------------------

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setExtractedText("");
    setWords([]);
    setSelectedWord(null);
    setTranslation(null);
    setRegistered(false);

    try {
      const text = await uploadImage(file);
      setExtractedText(text);
      // Split into tappable words
      const tokens = text.split(/\s+/).filter(Boolean);
      setWords(tokens);
    } catch (err) {
      alert("OCR に失敗しました: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 2: Select a word & translate ------------------------------------

  const handleWordTap = async (word: string) => {
    setSelectedWord(word);
    setTranslation(null);
    setRegistered(false);
    setLoading(true);

    try {
      const result = await translateWord(word, extractedText);
      setTranslation(result);
    } catch (err) {
      alert("翻訳に失敗しました: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 3: Register card ------------------------------------------------

  const handleRegister = async () => {
    if (!translation) return;
    setLoading(true);
    try {
      await createCard(translation.word, translation.translation, translation.example);
      setRegistered(true);
    } catch (err) {
      alert("カード登録に失敗しました: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Render ---------------------------------------------------------------

  return (
    <section className="capture">
      {/* Camera input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden-input"
        onChange={handleCapture}
      />
      <button className="btn-primary" onClick={() => fileRef.current?.click()}>
        📷 カメラで撮影
      </button>

      {loading && <p className="status">処理中…</p>}

      {/* Extracted words */}
      {words.length > 0 && (
        <div className="word-cloud">
          <p className="label">単語をタップして選択:</p>
          <div className="words">
            {words.map((w, i) => (
              <span
                key={i}
                className={`word ${selectedWord === w ? "selected" : ""}`}
                onClick={() => handleWordTap(w)}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Translation result */}
      {translation && (
        <div className="result-card">
          <h3>{translation.word}</h3>
          <p className="translation">{translation.translation}</p>
          {translation.example && (
            <p className="example">💬 {translation.example}</p>
          )}

          {registered ? (
            <p className="success">✅ Anki に登録しました！</p>
          ) : (
            <button className="btn-register" onClick={handleRegister} disabled={loading}>
              カードを登録
            </button>
          )}
        </div>
      )}
    </section>
  );
}
