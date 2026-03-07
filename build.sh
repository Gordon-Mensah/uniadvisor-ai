#!/usr/bin/env bash
# build.sh — UniAdvisor AI — Render Build Script
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UniAdvisor AI — Render Build Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Force Python 3.11 via environment variable ────────────
# Render respects PYTHON_VERSION env var set in dashboard
echo "Python: $(python --version)"
echo "Node:   $(node --version)"

# ── 1. Python dependencies ────────────────────────────────
echo ""
echo "▶ Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# ── 2. Node dependencies ──────────────────────────────────
echo ""
echo "▶ Installing Node dependencies..."
npm install

# ── 3. Build React app ────────────────────────────────────
echo ""
echo "▶ Building React frontend..."
npm run build

echo ""
echo "✅ Build complete!"