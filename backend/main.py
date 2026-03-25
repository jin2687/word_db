"""Translation Flashcard PWA - Backend API"""

import base64

import httpx
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_VISION_MODEL = "glm-ocr"        # OCR specialist (0.9B, fast & accurate)
OLLAMA_TEXT_MODEL = "qwen3.5:9b"       # Translation (thinking disabled)

ANKI_CONNECT_URL = "http://localhost:8765"
ANKI_DECK_NAME = "English Vocabulary"
ANKI_MODEL_NAME = "Basic"

# ---------------------------------------------------------------------------
# Prompt templates (easy to tweak later)
# ---------------------------------------------------------------------------


def build_ocr_prompt() -> str:
    return (
        "Extract all visible English text from this image. "
        "Return ONLY the extracted text, with no commentary or explanation."
    )


def build_translation_prompt(word: str, context: str) -> str:
    return (
        f"Translate the English word \"{word}\" into Japanese.\n"
        f"Context sentence: \"{context}\"\n\n"
        "Respond in the following format ONLY:\n"
        "Translation: <Japanese translation>\n"
        "Example: <short example sentence in English using the word>"
    )


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Translation Flashcard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def call_ollama_vision(image_bytes: bytes, prompt: str) -> str:
    """Send an image to Ollama vision model and return the response text."""
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "model": OLLAMA_VISION_MODEL,
        "prompt": prompt,
        "images": [b64_image],
        "stream": False,
        "options": {"num_predict": 2048},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json()["response"]


async def call_ollama_text(prompt: str) -> str:
    """Send a text prompt to Ollama and return the response."""
    payload = {
        "model": OLLAMA_TEXT_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"num_predict": 1024},
        "think": False,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json()["response"]


async def anki_request(action: str, **params) -> dict:
    """Send a request to AnkiConnect."""
    payload = {"action": action, "version": 6, "params": params}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(ANKI_CONNECT_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        if data.get("error"):
            raise Exception(f"AnkiConnect error: {data['error']}")
        return data


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class TranslateRequest(BaseModel):
    word: str
    context: str


class TranslateResponse(BaseModel):
    word: str
    translation: str
    example: str


class CreateCardRequest(BaseModel):
    word: str
    translation: str
    example: str


class AnswerCardRequest(BaseModel):
    card_id: int
    ease: int  # 1=Again, 2=Hard, 3=Good, 4=Easy


class CardInfo(BaseModel):
    card_id: int
    front: str
    back: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Check connectivity to Ollama and AnkiConnect."""
    status: dict = {"api": True, "ollama": False, "anki": False, "ollama_models": []}

    # Check Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                status["ollama"] = True
                models = resp.json().get("models", [])
                status["ollama_models"] = [m["name"] for m in models]
    except Exception:
        pass

    # Check AnkiConnect
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                ANKI_CONNECT_URL,
                json={"action": "version", "version": 6},
            )
            if resp.status_code == 200 and resp.json().get("result"):
                status["anki"] = True
    except Exception:
        pass

    return status


@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Receive an image, run OCR via Ollama vision model, return text."""
    image_bytes = await file.read()
    prompt = build_ocr_prompt()
    extracted_text = await call_ollama_vision(image_bytes, prompt)
    return {"text": extracted_text.strip()}


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """Translate a selected English word into Japanese using context."""
    prompt = build_translation_prompt(req.word, req.context)
    raw = await call_ollama_text(prompt)

    # Parse the structured response
    translation = ""
    example = ""
    for line in raw.strip().splitlines():
        lower = line.lower()
        if lower.startswith("translation:"):
            translation = line.split(":", 1)[1].strip()
        elif lower.startswith("example:"):
            example = line.split(":", 1)[1].strip()

    # Fallback: if parsing failed, use raw output as translation
    if not translation:
        translation = raw.strip()

    return TranslateResponse(word=req.word, translation=translation, example=example)


@app.post("/create-card")
async def create_card(req: CreateCardRequest):
    """Create a new Anki flashcard via AnkiConnect."""
    # Ensure the deck exists
    await anki_request("createDeck", deck=ANKI_DECK_NAME)

    front = f"<b>{req.word}</b><br><br><i>{req.example}</i>"
    back = f"<b>{req.translation}</b>"

    note = {
        "deckName": ANKI_DECK_NAME,
        "modelName": ANKI_MODEL_NAME,
        "fields": {"Front": front, "Back": back},
        "options": {"allowDuplicate": False},
        "tags": ["flashcard-pwa"],
    }
    result = await anki_request("addNote", note=note)
    return {"note_id": result["result"]}


@app.get("/due-cards", response_model=list[CardInfo])
async def due_cards():
    """Get today's due cards from Anki."""
    find_result = await anki_request(
        "findCards", query=f'"deck:{ANKI_DECK_NAME}" is:due'
    )
    card_ids: list[int] = find_result["result"]

    if not card_ids:
        return []

    info_result = await anki_request("cardsInfo", cards=card_ids)
    cards: list[CardInfo] = []
    for c in info_result["result"]:
        cards.append(
            CardInfo(
                card_id=c["cardId"],
                front=c["fields"]["Front"]["value"],
                back=c["fields"]["Back"]["value"],
            )
        )
    return cards


@app.post("/answer-card")
async def answer_card(req: AnswerCardRequest):
    """Submit a review answer for a card."""
    await anki_request("answerCards", answers=[
        {"cardId": req.card_id, "ease": req.ease}
    ])
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
