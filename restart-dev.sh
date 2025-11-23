#!/bin/bash

echo "🔄 Restarting Next.js dev server with fresh environment..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found!"
    exit 1
fi

echo "✅ Found .env.local file:"
cat .env.local
echo ""

# Kill any existing Next.js processes
echo "🛑 Stopping any running Next.js processes..."
pkill -f "next dev" 2>/dev/null || echo "   No running processes found"
sleep 2

# Clear Next.js cache
echo "🧹 Clearing Next.js cache..."
rm -rf .next
echo "✅ Cache cleared"
echo ""

# Start the dev server
echo "🚀 Starting Next.js dev server..."
echo "   The server will use the API URL from .env.local"
echo "   Press Ctrl+C to stop the server"
echo ""
npm run dev

