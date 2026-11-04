#!/bin/sh
# Build Raff for macOS and publish it as a GitHub release.
#
# Installed copies of Raff read the latest release of the repo below: once this
# finishes, they offer the update within a few hours (or at their next launch).
#
# Needs: the GitHub CLI, signed in once:  brew install gh && gh auth login
# Usage: raise "version" in package.json, then:  npm run release:mac
set -e
cd "$(dirname "$0")/.."

REPO="cdh30234/Raff"
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

command -v gh >/dev/null || { echo "GitHub CLI missing: brew install gh && gh auth login"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Not signed in to GitHub: gh auth login"; exit 1; }
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release $TAG already exists. Raise \"version\" in package.json first."
  exit 1
fi

# A local Electron (node_modules/electron/dist) saves a 120 MB download per build.
rm -rf dist
npm run build
npx electron-builder --mac dmg zip --arm64 --publish never -c.electronDist=node_modules/electron/dist

# The zip is what the in-app updater downloads; latest-mac.yml holds its SHA-512.
gh release create "$TAG" \
  "dist/Raff-$VERSION-mac-arm64.dmg" \
  "dist/Raff-$VERSION-mac-arm64.zip" \
  "dist/latest-mac.yml" \
  --repo "$REPO" \
  --title "Raff $VERSION" \
  --generate-notes

echo "Published $TAG: https://github.com/$REPO/releases/tag/$TAG"
