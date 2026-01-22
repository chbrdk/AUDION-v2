#!/bin/bash
# Isolated build test that simulates Coolify environment
# This clones the repo and builds in isolation without affecting local setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="/tmp/audion-build-test-$$"
REPO_URL="https://github.com/chbrdk/AUDION-v2.git"
BRANCH="main"

echo "🔨 Starting isolated build test (simulating Coolify environment)..."
echo "=========================================="
echo "📁 Temporary directory: $TEMP_DIR"
echo "📦 Repository: $REPO_URL"
echo "🌿 Branch: $BRANCH"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up temporary directory..."
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Create temporary directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Clone repository (shallow clone for speed)
echo "📥 Cloning repository..."
git clone --depth=1 --branch "$BRANCH" "$REPO_URL" audion-test || {
    echo "❌ Failed to clone repository. Using local files instead..."
    # Fallback: copy local files
    cp -r "$SCRIPT_DIR"/* "$TEMP_DIR/audion-test/" 2>/dev/null || true
    cd "$TEMP_DIR/audion-test"
    # Remove git files to avoid conflicts
    rm -rf .git
}

cd "$TEMP_DIR/audion-test"

# Set environment variables similar to Coolify
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

echo "🔧 Environment variables set"
echo ""

# Build only the web service (this is what fails in Coolify)
echo "🏗️  Building web service..."
echo "=========================================="

# Use docker compose build with the same args as Coolify
docker compose build \
    --build-arg RUN_WEB_BUILD=true \
    web 2>&1 | tee "$TEMP_DIR/build-output.log"

BUILD_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "=========================================="

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📄 Full log saved to: $TEMP_DIR/build-output.log"
else
    echo "❌ Build failed with exit code: $BUILD_EXIT_CODE"
    echo "📄 Full log saved to: $TEMP_DIR/build-output.log"
    echo ""
    echo "🔍 Last 50 lines of build output:"
    echo "-----------------------------------"
    tail -n 50 "$TEMP_DIR/build-output.log"
    echo ""
    echo "💡 To see full log: cat $TEMP_DIR/build-output.log"
    exit $BUILD_EXIT_CODE
fi
