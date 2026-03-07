#!/usr/bin/env bash
# build.sh — UniAdvisor AI — Render Build Script
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UniAdvisor AI — Render Build Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Python: $(python --version)"
echo "Node:   $(node --version)"

# ── 1. Python dependencies ────────────────────────────────
echo ""
echo "▶ Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# ── 2. Pre-download embedding model at build time ─────────
# This avoids a timeout on first request after deploy
echo ""
echo "▶ Pre-downloading embedding model (all-MiniLM-L6-v2)..."
export SENTENCE_TRANSFORMERS_HOME="./.model_cache"
python -c "
from sentence_transformers import SentenceTransformer
print('Downloading all-MiniLM-L6-v2...')
SentenceTransformer('all-MiniLM-L6-v2')
print('Model ready.')
"

# ── 3. Node dependencies ──────────────────────────────────
echo ""
echo "▶ Installing Node dependencies..."
npm install

# ── 4. Build React app ────────────────────────────────────
echo ""
echo "▶ Building React frontend..."
npm run build

echo ""
echo "✅ Build complete!"