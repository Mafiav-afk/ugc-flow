#!/bin/zsh
set -euo pipefail
export COPYFILE_DISABLE=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="1.3.0"
ARCH="arm64"
BUILD="/private/tmp/ugc-flow-mac-build-$UID"
APP="$BUILD/UGC Flow 安装器.app"
CONTENTS="$APP/Contents"
PAYLOAD="$CONTENTS/Resources/payload"
RELEASE="$ROOT/release"
NODE_RUNTIME="${NODE_RUNTIME:-/Users/liziming/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node}"

if [[ ! -x "$NODE_RUNTIME" ]]; then NODE_RUNTIME="$(command -v node)"; fi
cd "$ROOT"
npm run catalog
if [[ "${UGC_FLOW_SKIP_FRONTEND_BUILD:-0}" == "1" && -f "$ROOT/dist/index.html" ]]; then
  echo "Using existing verified frontend dist (server-only package update)"
else
  npm run build
fi
/bin/rm -rf "$BUILD"
/bin/mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources" "$PAYLOAD/app" "$RELEASE"
DOCS_STAGE="$BUILD/使用说明与API文档"
/bin/mkdir -p "$DOCS_STAGE"
/usr/bin/xattr -cr "$BUILD" 2>/dev/null || true
for item in \
  "快速开始.txt" \
  "UGC-Flow-软件操作说明.pdf" "UGC-Flow-软件操作说明.md" \
  "UGC-Flow-API接入说明.pdf" "UGC-Flow-API接入说明.md" \
  "UGC-Flow-视频讲解脚本.pdf" "UGC-Flow-视频讲解脚本.md"; do
  /bin/cp "$ROOT/docs/$item" "$DOCS_STAGE/$item"
done

/usr/bin/swiftc "$ROOT/macos/UGCFlowInstaller.swift" -o "$CONTENTS/MacOS/UGCFlowInstaller" -framework AppKit
/bin/cp "$ROOT/macos/Info.plist" "$CONTENTS/Info.plist"
/bin/cp "$ROOT/macos/install.sh" "$CONTENTS/Resources/install.sh"
/bin/chmod 755 "$CONTENTS/Resources/install.sh"

for item in dist server shared public skills package.json package-lock.json; do /usr/bin/ditto "$ROOT/$item" "$PAYLOAD/app/$item"; done
/bin/cp -R "$DOCS_STAGE" "$PAYLOAD/app/docs"
INSTALLED_DEPS="$HOME/Library/Application Support/UGC Flow/app/node_modules"
if [[ "${UGC_FLOW_REUSE_INSTALLED_DEPS:-0}" == "1" && -d "$INSTALLED_DEPS" ]]; then
  echo "Using verified installed production dependencies"
  /usr/bin/ditto "$INSTALLED_DEPS" "$PAYLOAD/app/node_modules"
else
  /usr/bin/ditto "$ROOT/node_modules" "$PAYLOAD/app/node_modules"
fi
(
  cd "$PAYLOAD/app"
  npm prune --omit=dev --ignore-scripts >/dev/null
)
/bin/cp "$NODE_RUNTIME" "$PAYLOAD/node"
/bin/chmod 755 "$PAYLOAD/node"
/usr/bin/find "$APP" -name '._*' -delete
/usr/bin/xattr -cr "$APP" 2>/dev/null || true
/usr/bin/codesign --force --deep --sign - "$APP"

ZIP="$RELEASE/UGC-Flow-Mac-$VERSION-$ARCH.zip"
DMG="$RELEASE/UGC-Flow-Mac-$VERSION-$ARCH.dmg"
DELIVERY="$RELEASE/UGC-Flow-Mac-$VERSION-完整资料包.zip"
/bin/rm -f "$ZIP" "$DMG" "$DELIVERY"
/usr/bin/ditto -c -k --keepParent "$APP" "$ZIP"
DMG_DIR="$BUILD/dmg"
/bin/mkdir -p "$DMG_DIR"
/usr/bin/ditto --norsrc --noextattr "$APP" "$DMG_DIR/UGC Flow 安装器.app"
/bin/cp -R "$DOCS_STAGE" "$DMG_DIR/使用说明与API文档"
/bin/ln -s /Applications "$DMG_DIR/Applications"
/usr/bin/xattr -cr "$DMG_DIR" 2>/dev/null || true
/usr/bin/hdiutil create -volname "UGC Flow" -srcfolder "$DMG_DIR" -ov -format UDZO "$DMG"
DELIVERY_DIR="$BUILD/UGC Flow Mac 1.3.0 完整资料包"
/bin/mkdir -p "$DELIVERY_DIR"
/bin/cp "$DMG" "$DELIVERY_DIR/UGC-Flow-Mac-$VERSION-$ARCH.dmg"
/bin/cp -R "$DOCS_STAGE" "$DELIVERY_DIR/使用说明与API文档"
/usr/bin/ditto -c -k --keepParent "$DELIVERY_DIR" "$DELIVERY"
/usr/bin/shasum -a 256 "$ZIP" "$DMG" "$DELIVERY" > "$RELEASE/SHA256.txt"
LOCAL_BUILD="$ROOT/build/macos"
/bin/rm -rf "$LOCAL_BUILD"
/bin/mkdir -p "$LOCAL_BUILD"
/usr/bin/ditto --norsrc --noextattr "$APP" "$LOCAL_BUILD/UGC Flow 安装器.app"
echo "$LOCAL_BUILD/UGC Flow 安装器.app"
echo "$ZIP"
echo "$DMG"
echo "$DELIVERY"
