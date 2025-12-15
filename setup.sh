#!/bin/bash

# setup.sh - Install and Build Flipkart Scraper Extension

echo "==========================================="
echo "   Flipkart Scraper Extension Setup"
echo "==========================================="

# Check for Node.js
if ! command -v node &> /dev/null
then
    echo "❌ Node.js could not be found. Please install Node.js (v18+) and try again."
    exit 1
fi
echo "✅ Node.js detected."

# Check for npm
if ! command -v npm &> /dev/null
then
    echo "❌ npm could not be found. Please install npm and try again."
    exit 1
fi
echo "✅ npm detected."

echo "-------------------------------------------"
echo "📦 Installing Dependencies..."
echo "-------------------------------------------"

npm install

if [ $? -ne 0 ]; then
    echo "❌ Dependencies installation failed."
    exit 1
fi

echo "-------------------------------------------"
echo "🛠️  Building Extension..."
echo "-------------------------------------------"

npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed."
    exit 1
fi

echo "==========================================="
echo "✅ Setup Complete Successfully!"
echo "==========================================="
echo " "
echo "Next Steps:"
echo "1. Open Google Chrome."
echo "2. Go to chrome://extensions/"
echo "3. Enable 'Developer mode' (top right)."
echo "4. Click 'Load unpacked'."
echo "5. Select the 'dist' folder at:"
echo "   $(pwd)/dist"
echo " "
