#!/usr/bin/env bash
# Quick setup script for development
set -e

PROJ="$(cd "$(dirname "$0")" && pwd)"

echo "=== Doom Tournament App Setup ==="

# Ensure better-sqlite3 binary is present
BINARY="$PROJ/node_modules/better-sqlite3/lib/binding/node-v127-linux-x64/better_sqlite3.node"
if [ ! -f "$BINARY" ]; then
  echo "Downloading better-sqlite3 prebuilt binary for Node 22..."
  mkdir -p "$(dirname "$BINARY")"
  curl -L "https://github.com/WiseLibs/better-sqlite3/releases/download/v12.6.2/better-sqlite3-v12.6.2-node-v127-linux-x64.tar.gz" \
    -o /tmp/bs3.tar.gz
  tar -xzf /tmp/bs3.tar.gz -C "$(dirname "$BINARY")"
  cp "$(dirname "$BINARY")/build/Release/better_sqlite3.node" "$BINARY"
  echo "Binary installed."
else
  echo "better-sqlite3 binary already present."
fi

# Check .env
if [ ! -f "$PROJ/.env" ]; then
  echo ""
  echo "No .env file found! Create one from .env.example:"
  echo "  cp .env.example .env"
  echo "  # Then edit .env with your values"
  echo ""
  echo "To generate a bcrypt hash for your admin password:"
  echo "  node -e \"const b=require('bcryptjs'); b.hash('yourpassword',12).then(console.log)\""
fi

echo "=== Setup complete ==="
