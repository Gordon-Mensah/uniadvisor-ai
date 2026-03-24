#!/usr/bin/env bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UniAdvisor AI — Render Build Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Python: $(python --version)"
echo "Node:   $(node --version)"

echo ""
echo "▶ Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "▶ Installing Node dependencies..."
npm install

echo ""
echo "▶ Building React frontend..."
npm run build

echo ""
echo "✅ Build complete!"