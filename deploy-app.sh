#!/bin/bash
# DotStudio POS — deploy the working tree into the macOS .app bundle and relaunch.
#
# IMPORTANT: launcher.py serves Contents/Resources/web (that is the folder the
# running app actually loads). Contents/Resources/app is only a redundant copy,
# so we sync to BOTH — web/ is the one that matters.

set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="DotStudio-POS.app"
RES="$APP_NAME/Contents/Resources"
WEB_DIR="$RES/web"
APP_DIR="$RES/app"

EXCLUDES=(
  --exclude=".git"
  --exclude="node_modules"
  --exclude="*.app"
  --exclude=".DS_Store"
  --exclude=".venv-osm"
  --exclude="__pycache__"
  --exclude="smoke.js"
)

# 1. Close the running app
killall "DotStudio-POS" 2>/dev/null || true
pkill -f "DotStudio-POS" 2>/dev/null || true
sleep 1
echo "⏳ تم إغلاق التطبيق..."

# 2. Sync the new files into the bundle
rsync -a --delete "${EXCLUDES[@]}" ./ "$WEB_DIR/"
rsync -a --delete "${EXCLUDES[@]}" ./ "$APP_DIR/"
echo "✅ تم تحديث الملفات داخل التطبيق (web + app)"

# 3. Relaunch
echo "✅ جاري فتح التطبيق..."
open "$APP_NAME"
