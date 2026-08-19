#!/usr/bin/env bash
# src/ 配下の分割ソース(shell.html + sprites_data.js + game.js + ui.jsx)から、
# 単一ファイルの jintoria.html を生成するビルドスクリプト。
# Node/Python不要、bash+awkのみで動作(Git Bash / Linuxどちらでも実行可)。
# 実行: bash build.sh
set -euo pipefail
cd "$(dirname "$0")"

SHELL_HTML=src/shell.html
SPRITES=src/sprites_data.js
GAME=src/game.js
UI=src/ui.jsx
OUT=jintoria.html

if ! grep -qF '<script type="text/babel" src="ui.jsx"></script>' "$SHELL_HTML"; then
  echo "build.sh: src/shell.html 内に ui.jsx の差し込み用タグが見つかりません" >&2
  exit 1
fi
if ! grep -qF '<script src="sprites_data.js"></script>' "$SHELL_HTML"; then
  echo "build.sh: src/shell.html 内に sprites_data.js の差し込み用タグが見つかりません" >&2
  exit 1
fi
if ! grep -qF '<script src="game.js"></script>' "$SHELL_HTML"; then
  echo "build.sh: src/shell.html 内に game.js の差し込み用タグが見つかりません" >&2
  exit 1
fi

awk -v ui="$UI" -v sprites="$SPRITES" -v game="$GAME" '
  $0 == "<script type=\"text/babel\" src=\"ui.jsx\"></script>" {
    print "<script type=\"text/babel\">"
    while ((getline line < ui) > 0) print line
    print "</script>"
    next
  }
  $0 == "<script src=\"sprites_data.js\"></script>" {
    print "<script>"
    while ((getline line < sprites) > 0) print line
    print "</script>"
    next
  }
  $0 == "<script src=\"game.js\"></script>" {
    print "<script>"
    while ((getline line < game) > 0) print line
    print "</script>"
    next
  }
  { print }
' "$SHELL_HTML" > "$OUT"

echo "Built $OUT ($(wc -c < "$OUT") bytes)"
