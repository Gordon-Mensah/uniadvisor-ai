#!/usr/bin/env bash
# build.sh — Render build script for UniAdvisor AI
# Installs Python deps + Node deps + builds React app into dist/
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UniAdvisor AI — Render Build Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Python dependencies ─────────────────────────────────
echo ""
echo "▶ Installing Python dependencies..."
pip install -r requirements.txt

# ── 2. Node.js / npm ───────────────────────────────────────
echo ""
echo "▶ Installing Node dependencies..."
npm install

# ── 3. Build React app ─────────────────────────────────────
echo ""
echo "▶ Building React frontend..."
npm run build

echo ""
echo "✅ Build complete! dist/ folder ready."