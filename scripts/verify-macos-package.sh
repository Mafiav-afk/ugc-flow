#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ZIP="$ROOT/release/UGC-Flow-Mac-1.3.0-arm64.zip"
DMG="$ROOT/release/UGC-Flow-Mac-1.3.0-arm64.dmg"
TMP="$(/usr/bin/mktemp -d /tmp/ugc-flow-mac-verify.XXXXXX)"
SERVER_PID=""
MOUNT_POINT=""
cleanup() {
  [[ -n "$SERVER_PID" ]] && /bin/kill "$SERVER_PID" >/dev/null 2>&1 || true
  [[ -n "$MOUNT_POINT" ]] && /usr/bin/hdiutil detach "$MOUNT_POINT" -quiet >/dev/null 2>&1 || true
  /bin/rm -rf "$TMP"
}
trap cleanup EXIT

/usr/bin/ditto -x -k "$ZIP" "$TMP/zip"
ZIP_APP="$TMP/zip/UGC Flow 安装器.app"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$ZIP_APP"
/usr/bin/plutil -lint "$ZIP_APP/Contents/Info.plist"
/usr/bin/hdiutil verify "$DMG"
MOUNT_POINT="$TMP/mount"
/bin/mkdir -p "$MOUNT_POINT"
/usr/bin/hdiutil attach "$DMG" -readonly -nobrowse -mountpoint "$MOUNT_POINT" -quiet
/usr/bin/codesign --verify --deep --strict --verbose=2 "$MOUNT_POINT/UGC Flow 安装器.app"

UGC_FLOW_INSTALL_ROOT="$TMP/install" \
UGC_FLOW_CODEX_SKILLS="$TMP/codex-skills" \
UGC_FLOW_CLAUDE_SKILLS="$TMP/claude-skills" \
UGC_FLOW_SKIP_LAUNCH=1 \
/bin/zsh "$ZIP_APP/Contents/Resources/install.sh" codex claude

# Reinstall over the same target to verify atomic runtime replacement during upgrades.
UGC_FLOW_INSTALL_ROOT="$TMP/install" \
UGC_FLOW_CODEX_SKILLS="$TMP/codex-skills" \
UGC_FLOW_CLAUDE_SKILLS="$TMP/claude-skills" \
UGC_FLOW_SKIP_LAUNCH=1 \
/bin/zsh "$ZIP_APP/Contents/Resources/install.sh" codex claude

for target in "$TMP/codex-skills" "$TMP/claude-skills"; do
  for skill in ai-ugc-realism winning-ad-formats merchant-ugc-campaign ugc-flow-agent; do [[ -f "$target/$skill/SKILL.md" ]]; done
done
[[ -f "$TMP/install/app/skills/merchant-ugc-campaign/assets/merchant-templates.json" ]]
[[ -f "$TMP/install/app/shared/video-models.mjs" ]]

VERIFY_PORT="$(/bin/cat "$TMP/install/port")"
HOST=127.0.0.1 PORT="$VERIFY_PORT" "$TMP/install/bin/node" "$TMP/install/app/server/index.mjs" >"$TMP/server.log" 2>&1 &
SERVER_PID=$!
for _ in {1..50}; do
  /bin/kill -0 "$SERVER_PID" >/dev/null 2>&1 || { /bin/cat "$TMP/server.log"; exit 1; }
  if /usr/bin/curl -fsS "http://127.0.0.1:$VERIFY_PORT/api/health" > "$TMP/health.json" 2>/dev/null; then break; fi
  /bin/sleep 0.1
done
/usr/bin/grep -q '"service":"ugc-flow"' "$TMP/health.json"
/usr/bin/curl -fsS "http://127.0.0.1:$VERIFY_PORT/api/presets" | /usr/bin/grep -q '"compatible"'
AGENTS_JSON="$(/usr/bin/curl -fsS "http://127.0.0.1:$VERIFY_PORT/api/agents/status")"
echo "$AGENTS_JSON" | /usr/bin/grep -q '"codex"'
echo "$AGENTS_JSON" | /usr/bin/grep -q '"claude"'
echo "macOS ZIP, DMG, skills, and bundled service verification passed"
