import { useEffect, useState } from "react";
import { fetchDueCards, answerCard, CardInfo } from "../api/client";
import "./Review.css";

export default function Review() {
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  const loadCards = async () => {
    setLoading(true);
    setFinished(false);
    setIndex(0);
    setShowBack(false);
    try {
      const data = await fetchDueCards();
      setCards(data);
      if (data.length === 0) setFinished(true);
    } catch (err) {
      alert("カード取得に失敗しました: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const current = cards[index] ?? null;

  const handleAnswer = async (ease: number) => {
    if (!current) return;
    setLoading(true);
    try {
      await answerCard(current.card_id, ease);
      const next = index + 1;
      if (next >= cards.length) {
        setFinished(true);
      } else {
        setIndex(next);
        setShowBack(false);
      }
    } catch (err) {
      alert("回答送信に失敗しました: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Render ---------------------------------------------------------------

  if (loading && cards.length === 0) {
    return <p className="status">読み込み中…</p>;
  }

  if (finished) {
    return (
      <section className="review-done">
        <h2>🎉 お疲れさまでした！</h2>
        <p>今日の復習は完了です。</p>
        <button className="btn-reload" onClick={loadCards}>
          もう一度チェック
        </button>
      </section>
    );
  }

  return (
    <section className="review">
      <p className="progress">
        {index + 1} / {cards.length}
      </p>

      <div className="flashcard">
        <div
          className="card-face front"
          dangerouslySetInnerHTML={{ __html: current?.front ?? "" }}
        />

        {showBack && (
          <div
            className="card-face back"
            dangerouslySetInnerHTML={{ __html: current?.back ?? "" }}
          />
        )}
      </div>

      {!showBack ? (
        <button className="btn-show" onClick={() => setShowBack(true)}>
          答えを見る
        </button>
      ) : (
        <div className="answer-buttons">
          <button
            className="btn-again"
            onClick={() => handleAnswer(1)}
            disabled={loading}
          >
            忘れた
          </button>
          <button
            className="btn-good"
            onClick={() => handleAnswer(3)}
            disabled={loading}
          >
            覚えた
          </button>
        </div>
      )}
    </section>
  );
}
