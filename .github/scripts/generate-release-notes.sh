#!/bin/bash
# Release Notes Generator for TabezaConnect
#
# This script generates release notes from git commit history between tags.
# It categorizes commits by conventional commit prefixes and formats them
# into markdown sections for GitHub releases.
#
# Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
#
# Usage: ./generate-release-notes.sh <current_version>
# Example: ./generate-release-notes.sh 1.0.0
#
# Output: Markdown-formatted release notes written to stdout

set -e

# Check if version argument is provided
if [ -z "$1" ]; then
  echo "ERROR: Version argument required"
  echo "Usage: $0 <version>"
  exit 1
fi

CURRENT_VERSION="$1"
CURRENT_TAG="v${CURRENT_VERSION}"

echo "Generating release notes for ${CURRENT_TAG}..." >&2

# Find previous release tag
# Requirements: 6.1 - Find previous release tag using git describe
PREV_TAG=$(git describe --tags --abbrev=0 "${CURRENT_TAG}^" 2>/dev/null || echo "")

if [ -z "$PREV_TAG" ]; then
  echo "No previous tag found - this is the first release" >&2
  # Requirements: 6.5 - Handle first release case (no previous tag)
  COMMIT_RANGE="HEAD"
else
  echo "Previous tag: ${PREV_TAG}" >&2
  # Requirements: 6.1 - Extract commits between tags
  COMMIT_RANGE="${PREV_TAG}..${CURRENT_TAG}"
fi

# Extract commits between tags (or all commits for first release)
# Requirements: 6.1 - Extract commits using git log
# Format: "- commit_message (short_hash)"
# Exclude merge commits to keep changelog clean
ALL_COMMITS=$(git log ${COMMIT_RANGE} --pretty=format:"- %s (%h)" --no-merges 2>/dev/null || echo "")

if [ -z "$ALL_COMMITS" ]; then
  echo "No commits found in range ${COMMIT_RANGE}" >&2
  echo "## What's Changed"
  echo ""
  echo "No changes in this release."
  exit 0
fi

# Categorize commits by conventional commit prefixes
# Requirements: 6.2, 6.3 - Categorize commits by type (features, fixes, documentation)
FEATURES=$(echo "$ALL_COMMITS" | grep -i "^- feat:" || echo "")
FIXES=$(echo "$ALL_COMMITS" | grep -i "^- fix:" || echo "")
DOCS=$(echo "$ALL_COMMITS" | grep -i "^- docs:" || echo "")
CHORE=$(echo "$ALL_COMMITS" | grep -i "^- chore:" || echo "")
REFACTOR=$(echo "$ALL_COMMITS" | grep -i "^- refactor:" || echo "")
TEST=$(echo "$ALL_COMMITS" | grep -i "^- test:" || echo "")
STYLE=$(echo "$ALL_COMMITS" | grep -i "^- style:" || echo "")
PERF=$(echo "$ALL_COMMITS" | grep -i "^- perf:" || echo "")
BUILD=$(echo "$ALL_COMMITS" | grep -i "^- build:" || echo "")
CI=$(echo "$ALL_COMMITS" | grep -i "^- ci:" || echo "")

# Other commits (not matching conventional commit prefixes)
OTHER=$(echo "$ALL_COMMITS" | grep -v -i "^- feat:\|^- fix:\|^- docs:\|^- chore:\|^- refactor:\|^- test:\|^- style:\|^- perf:\|^- build:\|^- ci:" || echo "")

# Format release notes into markdown sections
# Requirements: 6.3 - Format into markdown sections
echo "## What's Changed"
echo ""

# Add features section if any features exist
if [ -n "$FEATURES" ]; then
  echo "### ✨ Features"
  echo "$FEATURES"
  echo ""
fi

# Add bug fixes section if any fixes exist
if [ -n "$FIXES" ]; then
  echo "### 🐛 Bug Fixes"
  echo "$FIXES"
  echo ""
fi

# Add documentation section if any docs changes exist
if [ -n "$DOCS" ]; then
  echo "### 📚 Documentation"
  echo "$DOCS"
  echo ""
fi

# Add performance improvements section if any exist
if [ -n "$PERF" ]; then
  echo "### ⚡ Performance Improvements"
  echo "$PERF"
  echo ""
fi

# Add refactoring section if any exist
if [ -n "$REFACTOR" ]; then
  echo "### ♻️ Code Refactoring"
  echo "$REFACTOR"
  echo ""
fi

# Add build/CI section if any exist
if [ -n "$BUILD" ] || [ -n "$CI" ]; then
  echo "### 🔧 Build & CI"
  [ -n "$BUILD" ] && echo "$BUILD"
  [ -n "$CI" ] && echo "$CI"
  echo ""
fi

# Add testing section if any exist
if [ -n "$TEST" ]; then
  echo "### 🧪 Tests"
  echo "$TEST"
  echo ""
fi

# Add chore section if any exist
if [ -n "$CHORE" ]; then
  echo "### 🔨 Chores"
  echo "$CHORE"
  echo ""
fi

# Add style section if any exist
if [ -n "$STYLE" ]; then
  echo "### 💄 Style Changes"
  echo "$STYLE"
  echo ""
fi

# Add other changes section if any exist
if [ -n "$OTHER" ]; then
  echo "### 📝 Other Changes"
  echo "$OTHER"
  echo ""
fi

# Add link to full changelog
# Requirements: 6.4 - Include link to full changelog
if [ -n "$PREV_TAG" ]; then
  echo "---"
  echo ""
  echo "**Full Changelog**: https://github.com/billoapp/TabezaConnect/compare/${PREV_TAG}...${CURRENT_TAG}"
else
  # First release - link to all commits
  echo "---"
  echo ""
  echo "**Full Changelog**: https://github.com/billoapp/TabezaConnect/commits/${CURRENT_TAG}"
fi

echo "" >&2
echo "✅ Release notes generated successfully" >&2
