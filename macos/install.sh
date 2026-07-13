#!/bin/zsh
set -euo pipefail

RESOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
PAYLOAD="$RESOURCE_DIR/payload"
INSTALL_ROOT="${UGC_FLOW_INSTALL_ROOT:-$HOME/Library/Application Support/UGC Flow}"
APP_DIR="$INSTALL_ROOT/app"
BIN_DIR="$INSTALL_ROOT/bin"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.ugcflow.local.plist"
PORT_FILE="$INSTALL_ROOT/port"

is_ugc_flow() {
  /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:$1/api/health" 2>/dev/null | /usr/bin/grep -q '"service":"ugc-flow"'
}

is_port_busy() {
  /usr/bin/nc -z 127.0.0.1 "$1" >/dev/null 2>&1
}

choose_port() {
  if [[ -n "${UGC_FLOW_PORT:-}" ]]; then
    echo "$UGC_FLOW_PORT"
    return
  fi
  if [[ -f "$PORT_FILE" ]]; then
    local saved
    saved="$(/bin/cat "$PORT_FILE" 2>/dev/null || true)"
    if [[ "$saved" == <-> ]] && { is_ugc_flow "$saved" || ! is_port_busy "$saved"; }; then
      echo "$saved"
      return
    fi
  fi
  local candidate
  for candidate in {18787..18807}; do
    if ! is_port_busy "$candidate"; then
      echo "$candidate"
      return
    fi
  done
  echo "找不到可用的本地端口（18787–18807）" >&2
  return 1
}

if [[ ! -x "$PAYLOAD/node" || ! -f "$PAYLOAD/app/server/index.mjs" ]]; then
  echo "安装包内容不完整" >&2
  exit 1
fi

/bin/mkdir -p "$INSTALL_ROOT" "$BIN_DIR"
if [[ "${UGC_FLOW_SKIP_LAUNCH:-0}" != "1" && -f "$LAUNCH_AGENT" ]]; then
  /bin/launchctl bootout "gui/$UID/com.ugcflow.local" >/dev/null 2>&1 || \
    /bin/launchctl bootout "gui/$UID" "$LAUNCH_AGENT" >/dev/null 2>&1 || true
  for _ in {1..30}; do
    if ! /bin/launchctl print "gui/$UID/com.ugcflow.local" >/dev/null 2>&1; then break; fi
    /bin/sleep 0.1
  done
fi
/usr/bin/ditto "$PAYLOAD/app" "$APP_DIR"
/bin/cp "$PAYLOAD/node" "$BIN_DIR/node.new"
/bin/chmod 755 "$BIN_DIR/node.new"
/bin/mv -f "$BIN_DIR/node.new" "$BIN_DIR/node"

PORT="$(choose_port)"
echo "$PORT" > "$PORT_FILE"

for target in "$@"; do
  case "$target" in
    codex) SKILL_DIR="${UGC_FLOW_CODEX_SKILLS:-$HOME/.codex/skills}" ;;
    claude) SKILL_DIR="${UGC_FLOW_CLAUDE_SKILLS:-$HOME/.claude/skills}" ;;
    *) continue ;;
  esac
  /bin/mkdir -p "$SKILL_DIR"
  for skill in ai-ugc-realism winning-ad-formats merchant-ugc-campaign ugc-flow-agent; do
    /usr/bin/ditto "$PAYLOAD/app/skills/$skill" "$SKILL_DIR/$skill"
  done
done

if [[ "${UGC_FLOW_SKIP_LAUNCH:-0}" != "1" ]]; then
  /bin/mkdir -p "$HOME/Library/LaunchAgents" "$INSTALL_ROOT/logs"
  /bin/cat > "$LAUNCH_AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.ugcflow.local</string>
<key>ProgramArguments</key><array><string>$BIN_DIR/node</string><string>$APP_DIR/server/index.mjs</string></array>
<key>WorkingDirectory</key><string>$APP_DIR</string>
<key>EnvironmentVariables</key><dict><key>HOST</key><string>127.0.0.1</string><key>PORT</key><string>$PORT</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$INSTALL_ROOT/logs/server.log</string>
<key>StandardErrorPath</key><string>$INSTALL_ROOT/logs/server-error.log</string>
</dict></plist>
PLIST
  /bin/launchctl bootstrap "gui/$UID" "$LAUNCH_AGENT"

  ready=0
  for _ in {1..40}; do
    if is_ugc_flow "$PORT"; then
      ready=1
      break
    fi
    /bin/sleep 0.25
  done
  if [[ "$ready" != "1" ]]; then
    echo "本地服务启动失败，请查看 $INSTALL_ROOT/logs/server-error.log" >&2
    exit 1
  fi
fi

echo "UGC Flow installed at $INSTALL_ROOT"
echo "UGC_FLOW_URL=http://127.0.0.1:$PORT"
