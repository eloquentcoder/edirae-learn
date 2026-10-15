#!/usr/bin/env bash
# Edirae Learn installer
# Installs the Edirae Learn skill / instructions into your coding agent.
#
# Usage (from a clone of this repo, inside your project folder):
#   bash /path/to/edirae-learn/install.sh --all
#
# Or straight from GitHub:
#   curl -fsSL https://raw.githubusercontent.com/eloquentcoder/edirae-learn/master/install.sh | bash -s -- --all
#
# Options:
#   --claude          Claude Code, for you everywhere   (~/.claude/skills/edirae-learn)
#   --claude-project  Claude Code, this project only    (./.claude/skills/edirae-learn)
#   --agents          AGENTS.md in this project (Codex, Cursor, Amp, Jules and other agents that read AGENTS.md)
#   --codex-global    Codex, for you everywhere         (~/.codex/AGENTS.md)
#   --cursor          Cursor project rule               (./.cursor/rules/edirae-learn.mdc)
#   --copilot         GitHub Copilot                    (./.github/copilot-instructions.md)
#   --gemini          Gemini CLI                        (./GEMINI.md)
#   --all             --claude-project --agents --cursor --copilot --gemini
#   --uninstall       Remove Edirae Learn from every location above
#   -h, --help        Show this help

set -euo pipefail

REPO="${EDIRAE_LEARN_REPO:-eloquentcoder/edirae-learn}"
BRANCH="${EDIRAE_LEARN_BRANCH:-master}"
START_MARK="<!-- edirae-learn:start -->"
END_MARK="<!-- edirae-learn:end -->"

say() { printf '%s\n' "$*"; }
usage() { sed -n '2,22p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//' || true; }

# ---- locate source files (local clone, or download from GitHub) ----
SRC=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/skills/edirae-learn/SKILL.md" ]; then
  SRC="$SCRIPT_DIR"
fi

fetch_source() {
  if [ -n "$SRC" ]; then return; fi
  if [[ "$REPO" == YOUR-GITHUB-USER/* ]]; then
    say "Error: set EDIRAE_LEARN_REPO=<owner>/edirae-learn, or run this script from a clone of the repo." >&2
    exit 1
  fi
  local tmp; tmp="$(mktemp -d)"
  say "Downloading Edirae Learn from github.com/$REPO ..."
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$tmp"
  SRC="$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -n 1)"
  if [ ! -f "$SRC/skills/edirae-learn/SKILL.md" ]; then
    say "Error: download did not contain skills/edirae-learn/SKILL.md" >&2
    exit 1
  fi
}

# ---- helpers ----
copy_skill() { # $1 = destination skills dir
  local dest="$1/edirae-learn"
  mkdir -p "$1"
  rm -rf "$dest"
  cp -R "$SRC/skills/edirae-learn" "$dest"
  say "  ✓ Skill installed at $dest"
}

remove_block() { # $1 = file
  local f="$1"
  [ -f "$f" ] || return 0
  if grep -qF "$START_MARK" "$f"; then
    awk -v s="$START_MARK" -v e="$END_MARK" '
      index($0, s) { skip=1; next }
      index($0, e) { skip=0; next }
      !skip { print }
    ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
}

upsert_block() { # $1 = file
  local f="$1"
  mkdir -p "$(dirname "$f")"
  touch "$f"
  remove_block "$f"
  if [ -s "$f" ]; then printf '\n' >> "$f"; fi
  cat "$SRC/adapters/edirae-learn-instructions.md" >> "$f"
  say "  ✓ Instructions added to $f"
}

do_claude()          { fetch_source; copy_skill "$HOME/.claude/skills"; }
do_claude_project()  { fetch_source; copy_skill "./.claude/skills"; }
do_agents()          { fetch_source; upsert_block "./AGENTS.md"; }
do_codex_global()    { fetch_source; upsert_block "$HOME/.codex/AGENTS.md"; }
do_cursor()          { fetch_source; mkdir -p ./.cursor/rules; cp "$SRC/adapters/cursor/edirae-learn.mdc" ./.cursor/rules/edirae-learn.mdc; say "  ✓ Cursor rule added at ./.cursor/rules/edirae-learn.mdc"; }
do_copilot()         { fetch_source; upsert_block "./.github/copilot-instructions.md"; }
do_gemini()          { fetch_source; upsert_block "./GEMINI.md"; }

do_uninstall() {
  rm -rf "$HOME/.claude/skills/edirae-learn" "./.claude/skills/edirae-learn" ./.cursor/rules/edirae-learn.mdc
  for f in ./AGENTS.md "$HOME/.codex/AGENTS.md" ./.github/copilot-instructions.md ./GEMINI.md; do
    remove_block "$f"
  done
  say "  ✓ Edirae Learn removed. Your learn/ folder and existing breakdowns were left untouched."
}

# ---- main ----
if [ $# -eq 0 ]; then usage; exit 0; fi

say "Edirae Learn installer"
for arg in "$@"; do
  case "$arg" in
    --claude)          do_claude ;;
    --claude-project)  do_claude_project ;;
    --agents|--codex)  do_agents ;;
    --codex-global)    do_codex_global ;;
    --cursor)          do_cursor ;;
    --copilot)         do_copilot ;;
    --gemini)          do_gemini ;;
    --all)             do_claude_project; do_agents; do_cursor; do_copilot; do_gemini ;;
    --uninstall)       do_uninstall ;;
    -h|--help)         usage; exit 0 ;;
    *) say "Unknown option: $arg"; usage; exit 1 ;;
  esac
done
say "Done. Ask your agent to build something, then check the learn/ folder."
