#!/usr/bin/env bash
# Démarre le backend Rust et le frontend Vike dans le même terminal.
# Ctrl+C arrête les deux.
set -euo pipefail
cd "$(dirname "$0")"

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "→ Backend  http://localhost:8080/  (GraphiQL)"
(cd backend && cargo run) &

echo "→ Frontend http://localhost:3000/"
(cd frontend && npm run dev) &

wait
