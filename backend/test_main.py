"""Tests for the Translation Flashcard API."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---------------------------------------------------------------------------
# POST /upload-image
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_upload_image_success(client: AsyncClient):
    with patch("main.call_ollama_vision", new_callable=AsyncMock) as mock_vision:
        mock_vision.return_value = "  Hello World  "
        files = {"file": ("test.png", b"fake-image-bytes", "image/png")}
        resp = await client.post("/upload-image", files=files)

    assert resp.status_code == 200
    assert resp.json() == {"text": "Hello World"}
    mock_vision.assert_called_once()


@pytest.mark.anyio
async def test_upload_image_no_file(client: AsyncClient):
    resp = await client.post("/upload-image")
    assert resp.status_code == 422  # validation error


# ---------------------------------------------------------------------------
# POST /translate
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_translate_structured_response(client: AsyncClient):
    llm_response = "Translation: 走る\nExample: I run every morning."
    with patch("main.call_ollama_text", new_callable=AsyncMock) as mock_text:
        mock_text.return_value = llm_response
        resp = await client.post(
            "/translate",
            json={"word": "run", "context": "I run every morning."},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["word"] == "run"
    assert data["translation"] == "走る"
    assert data["example"] == "I run every morning."


@pytest.mark.anyio
async def test_translate_fallback_when_parsing_fails(client: AsyncClient):
    llm_response = "これは走るという意味です"
    with patch("main.call_ollama_text", new_callable=AsyncMock) as mock_text:
        mock_text.return_value = llm_response
        resp = await client.post(
            "/translate",
            json={"word": "run", "context": "I run every day"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["translation"] == "これは走るという意味です"
    assert data["example"] == ""


@pytest.mark.anyio
async def test_translate_missing_fields(client: AsyncClient):
    resp = await client.post("/translate", json={"word": "run"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /create-card
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_create_card_success(client: AsyncClient):
    with patch("main.anki_request", new_callable=AsyncMock) as mock_anki:
        mock_anki.side_effect = [
            {"result": None, "error": None},    # createDeck
            {"result": 12345, "error": None},    # addNote
        ]
        resp = await client.post(
            "/create-card",
            json={
                "word": "apple",
                "translation": "りんご",
                "example": "I ate an apple.",
            },
        )

    assert resp.status_code == 200
    assert resp.json() == {"note_id": 12345}
    assert mock_anki.call_count == 2


@pytest.mark.anyio
async def test_create_card_anki_error(client: AsyncClient):
    with patch("main.anki_request", new_callable=AsyncMock) as mock_anki:
        mock_anki.side_effect = Exception("AnkiConnect error: duplicate")
        with pytest.raises(Exception, match="AnkiConnect error"):
            await client.post(
                "/create-card",
                json={
                    "word": "apple",
                    "translation": "りんご",
                    "example": "I ate an apple.",
                },
            )


# ---------------------------------------------------------------------------
# GET /due-cards
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_due_cards_with_results(client: AsyncClient):
    with patch("main.anki_request", new_callable=AsyncMock) as mock_anki:
        mock_anki.side_effect = [
            {"result": [1001, 1002], "error": None},  # findCards
            {
                "result": [
                    {
                        "cardId": 1001,
                        "fields": {
                            "Front": {"value": "<b>apple</b>"},
                            "Back": {"value": "<b>りんご</b>"},
                        },
                    },
                    {
                        "cardId": 1002,
                        "fields": {
                            "Front": {"value": "<b>run</b>"},
                            "Back": {"value": "<b>走る</b>"},
                        },
                    },
                ],
                "error": None,
            },  # cardsInfo
        ]
        resp = await client.get("/due-cards")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["card_id"] == 1001
    assert data[0]["front"] == "<b>apple</b>"
    assert data[1]["back"] == "<b>走る</b>"


@pytest.mark.anyio
async def test_due_cards_empty(client: AsyncClient):
    with patch("main.anki_request", new_callable=AsyncMock) as mock_anki:
        mock_anki.return_value = {"result": [], "error": None}
        resp = await client.get("/due-cards")

    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# POST /answer-card
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_answer_card_success(client: AsyncClient):
    with patch("main.anki_request", new_callable=AsyncMock) as mock_anki:
        mock_anki.return_value = {"result": True, "error": None}
        resp = await client.post(
            "/answer-card",
            json={"card_id": 1001, "ease": 3},
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    mock_anki.assert_called_once_with(
        "answerCards", answers=[{"cardId": 1001, "ease": 3}]
    )


@pytest.mark.anyio
async def test_answer_card_invalid_payload(client: AsyncClient):
    resp = await client.post("/answer-card", json={"card_id": "abc"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Unit tests for helper / prompt functions
# ---------------------------------------------------------------------------


def test_build_ocr_prompt():
    from main import build_ocr_prompt

    prompt = build_ocr_prompt()
    assert "English text" in prompt
    assert len(prompt) > 10


def test_build_translation_prompt():
    from main import build_translation_prompt

    prompt = build_translation_prompt("run", "I run every day")
    assert "run" in prompt
    assert "I run every day" in prompt
    assert "Japanese" in prompt
