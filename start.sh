#!/usr/bin/env bash
#
# Translation Flashcard PWA – Startup Script
#
# Checks that all dependencies (Ollama, Anki/AnkiConnect) are running,
# then starts the backend and frontend dev servers.
#
# Usage:
#   ./start.sh          # check & start everything
#   ./start.sh --check  # only run health checks, don't start servers
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

OLLAMA_URL="http://localhost:11434"
ANKI_URL="http://localhost:8765"

# ---------- helpers ----------

ok()   { echo -e "  ${GREEN}[OK]${NC}   $1"; }
fail() { echo -e "  ${RED}[NG]${NC}   $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }

check_command() {
  if command -v "$1" &>/dev/null; then
    ok "$1 is installed"
    return 0
  else
    fail "$1 is not installed"
    return 1
  fi
}

# ---------- dependency checks ----------

echo ""
echo "========================================="
echo "  Flashcard PWA – Dependency Check"
echo "========================================="
echo ""

ERRORS=0

# -- Python / pip --
check_command python3 || ((ERRORS++))

# -- Node / npm --
check_command node || ((ERRORS++))
check_command npm  || ((ERRORS++))

# -- Ollama --
echo ""
echo "--- Ollama ---"
if check_command ollama; then
  if curl -sf "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
    ok "Ollama is running at ${OLLAMA_URL}"

    # Check required models
    MODELS=$(curl -sf "${OLLAMA_URL}/api/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('models', []):
    print(m['name'])
" 2>/dev/null || true)

    if echo "$MODELS" | grep -qi "qwen3.5"; then
      ok "Model (qwen3.5) is available"
    else
      warn "Model (qwen3.5) not found. Run: ollama pull qwen3.5:8b"
      ((ERRORS++))
    fi
  else
    fail "Ollama is not running. Start with: ollama serve"
    ((ERRORS++))
  fi
fi

# -- Anki + AnkiConnect --
echo ""
echo "--- Anki + AnkiConnect ---"
if curl -sf -X POST "${ANKI_URL}" \
    -H "Content-Type: application/json" \
    -d '{"action":"version","version":6}' >/dev/null 2>&1; then
  ok "AnkiConnect is running at ${ANKI_URL}"
else
  fail "AnkiConnect is not reachable at ${ANKI_URL}"
  echo "       Make sure Anki is open and AnkiConnect add-on is installed."
  ((ERRORS++))
fi

# ---------- summary ----------

echo ""
echo "========================================="
if [ "$ERRORS" -gt 0 ]; then
  echo -e "  ${RED}${ERRORS} issue(s) found.${NC} Fix the above and retry."
else
  echo -e "  ${GREEN}All checks passed!${NC}"
fi
echo "========================================="
echo ""

# If --check flag, exit here
if [[ "${1:-}" == "--check" ]]; then
  exit "$ERRORS"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${YELLOW}Some dependencies are missing. Continue anyway? [y/N]${NC}"
  read -r REPLY
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# ---------- install dependencies ----------

echo "Installing backend dependencies..."
cd "$(dirname "$0")/backend"
pip install -q -r requirements.txt

echo "Installing frontend dependencies..."
cd "$(dirname "$0")/frontend"
npm install --silent

# ---------- start servers ----------

echo ""
echo "Starting backend (FastAPI) on http://0.0.0.0:8000 ..."
cd "$(dirname "$0")/backend"
python3 main.py &
BACKEND_PID=$!

echo "Starting frontend (Vite) ..."
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo -e "  ${GREEN}Servers started!${NC}"
echo "  Backend PID:  ${BACKEND_PID}"
echo "  Frontend PID: ${FRONTEND_PID}"
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  Health:   http://localhost:8000/health"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all servers."

# Trap Ctrl+C to kill both
cleanup() {
  echo ""
  echo "Stopping servers..."
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

wait
