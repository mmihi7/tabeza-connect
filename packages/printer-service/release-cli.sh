#!/bin/bash
# Tabeza Printer Service - CLI Release Script
# This script automates the entire release process using GitHub CLI

set -e  # Exit on error

echo "╔════════════════════════════════════════╗"
echo "║  Tabeza Printer Service Release       ║"
echo "║  CLI Automated Release                 ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo ""
    echo "Install it from: https://cli.github.com/"
    echo ""
    echo "Windows: winget install --id GitHub.cli"
    echo "Or download from: https://github.com/cli/cli/releases"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Not logged in to GitHub"
    echo ""
    echo "Run: gh auth login"
    exit 1
fi

# Get GitHub username
GITHUB_USER=$(gh api user -q .login)
echo "✅ Logged in as: $GITHUB_USER"
echo ""

# Step 1: Build
echo "Step 1: Building executable..."
cd "$(dirname "$0")"
pnpm install
pnpm run build-installer

if [ ! -f "dist/tabeza-printer-service.exe" ]; then
    echo "❌ Build failed - .exe not found"
    exit 1
fi
echo "✅ Build complete"
echo ""

# Step 2: Create GitHub repository
echo "Step 2: Creating GitHub repository..."
if gh repo view "$GITHUB_USER/tabeza-printer-service" &> /dev/null; then
    echo "⚠️  Repository already exists, skipping creation"
else
    gh repo create tabeza-printer-service \
        --public \
        --description "Local Windows service for Tabeza POS printer integration" \
        --clone=false
    echo "✅ Repository created"
fi
echo ""

# Step 3: Initialize git and push
echo "Step 3: Pushing code to GitHub..."
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial commit: Tabeza Printer Service v1.0.0"
    git branch -M main
    git remote add origin "https://github.com/$GITHUB_USER/tabeza-printer-service.git"
fi

git push -u origin main --force
echo "✅ Code pushed"
echo ""

# Step 4: Create release
echo "Step 4: Creating GitHub release..."
gh release create v1.0.0 \
    dist/tabeza-printer-service.exe \
    dist/install.bat \
    dist/README.txt \
    --title "Tabeza Printer Service v1.0.0" \
    --notes "# Tabeza Printer Service v1.0.0

Windows service for integrating POS systems with Tabeza digital receipts.

## Installation

1. Download \`tabeza-printer-service.exe\`
2. Run as Administrator
3. Service will start on http://localhost:8765

## Requirements

- Windows 10 or later
- Administrator privileges
- Internet connection

## What's Included

- Standalone executable (no Node.js installation required)
- Automatic configuration
- Health monitoring

## Support

- Email: support@tabeza.co.ke
- Website: https://tabeza.co.ke"

echo "✅ Release created"
echo ""

# Step 5: Update download URLs
echo "Step 5: Updating download URLs in app..."
cd ../..
node packages/printer-service/update-download-urls.js "$GITHUB_USER"
echo ""

# Done!
echo "╔════════════════════════════════════════╗"
echo "║  Release Complete! 🎉                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Download URL:"
echo "https://github.com/$GITHUB_USER/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
echo ""
echo "Next steps:"
echo "1. Test the download in your app"
echo "2. Commit the URL changes: git add . && git commit -m 'Update printer service URLs'"
echo "3. Deploy your app"
echo ""
