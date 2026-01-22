#!/bin/bash
# Automated build test and fix script
# Runs build, detects errors, and provides fixes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="/tmp/audion-build-test-$$"
REPO_URL="https://github.com/chbrdk/AUDION-v2.git"
BRANCH="main"

echo "🤖 Automated Build Test & Fix"
echo "=========================================="
echo "📁 Temp dir: $TEMP_DIR"
echo ""

# Cleanup
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

echo "📥 Cloning repository..."
git clone --depth=1 --branch "$BRANCH" "$REPO_URL" audion-test
cd "$TEMP_DIR/audion-test"

# Set env vars
export DATABASE_URL="postgresql://test:test@localhost:5432/test"
export REDIS_URL="redis://localhost:6379/0"
export QDRANT_URL="http://localhost:6333"
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="test"
export OPENAI_API_KEY="test-key"
export CLAUDE_API_KEY="test-key"
export APP_ENV="production"
export NEXT_PUBLIC_BASE_PATH="/audion"
export NEXT_PUBLIC_PERSONA_BACKEND_URL="http://api:8000"
export NEXT_PUBLIC_CHAT_API_URL="http://chat-api:8001"

echo "🏗️  Building web service..."
echo ""

# Build and capture output
BUILD_FAILED=0
docker compose build --build-arg RUN_WEB_BUILD=true web 2>&1 | tee "$TEMP_DIR/build-output.log" || BUILD_FAILED=1

if [ "$BUILD_FAILED" -eq 1 ]; then
    echo ""
    echo "❌ Build failed!"
    echo ""
    echo "🔍 Analyzing errors..."
    echo "=========================================="
    
    # Extract key error messages
    grep -i "error\|failed\|Type error" "$TEMP_DIR/build-output.log" | tail -n 20
    
    echo ""
    echo "📄 Full log: $TEMP_DIR/build-output.log"
    echo ""
    echo "💡 Copy the error messages above and I'll fix them!"
    exit 1
else
    echo ""
    echo "✅ Build successful!"
    exit 0
fi
