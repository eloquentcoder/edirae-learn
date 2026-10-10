# Edirae Learn

**Your AI writes the code. Edirae Learn makes sure you still understand it.**

Every time your coding agent finishes a task, Edirae Learn has it leave a short breakdown in a `learn/` folder: what it built, why it built it that way, the one concept worth knowing, and three questions to check you actually get it. Two minutes of reading keeps you in control of your own codebase.

Works with Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI, and any agent that reads `AGENTS.md`.

---

## Why

AI can now write most of the code you ship. That's great, until you need to debug it, extend it, explain it in a code review, or answer questions about it in an interview, and you realise you never really understood it.

Reading the code later rarely helps. Being asked "what would break if we removed this lock?" does. Edirae Learn turns every change your agent makes into a short lesson with questions that make you think.

## What you get

After a meaningful change, your agent saves something like `learn/2026-10-10-add-payment-retry.md`:

- **In short:** what was done, in plain language
- **What changed:** each file and what changed there
- **How it works:** the flow, step by step
- **Why it's built this way:** the decisions, and what was considered instead
- **The concept worth knowing:** explained simply first, then precisely
- **Watch out for:** edge cases, risks, and what to test
- **Check yourself:** three questions, answers hidden until you click
- **Explain it back:** a prompt to put it in your own words

And it ends its reply with one line telling you where the breakdown is. See a full example in [`skills/edirae-learn/references/breakdown-template.md`](skills/edirae-learn/references/breakdown-template.md).

Trivial edits (typos, formatting, version bumps, one-line config) are skipped.

---

## Install

### Claude Code

**Option A: as a plugin**

```
/plugin marketplace add eloquentcoder/edirae-learn
/plugin install edirae-learn@edirae
```

This is the recommended way. Besides the skill, the plugin ships a Stop hook: when Claude is about to finish a turn in which it changed code but didn't save a breakdown, the hook asks it to write one (or to finish normally if the change was trivial). Whenever a breakdown is saved, the hook also shows you a one-line notice with its path, so you always know it is there. A skill on its own only runs when Claude thinks to use it, so without the hook breakdowns get skipped. The hook needs `node` on your PATH; without it, the hook does nothing.

The hook only sees files changed with Claude's edit tools (not shell commands or subagents), ignores docs and edits under 5 lines, and respects "skip learn", "turn off Edirae Learn" and `edirae.config.json`. Its tests run with `node --test tests/learn-stop.test.mjs`.

**Option B: copy the skill**

A copied skill doesn't include the Stop hook, so Claude may not always remember to write breakdowns.

```bash
# For you, in every project
git clone https://github.com/eloquentcoder/edirae-learn.git
mkdir -p ~/.claude/skills && cp -R edirae-learn/skills/edirae-learn ~/.claude/skills/

# Or for one project only (commit it so your team gets it too)
mkdir -p .claude/skills && cp -R edirae-learn/skills/edirae-learn .claude/skills/
```

### Codex, Cursor, Copilot, Gemini and others: the installer

From inside your project folder:

```bash
curl -fsSL https://raw.githubusercontent.com/eloquentcoder/edirae-learn/master/install.sh | EDIRAE_LEARN_REPO=eloquentcoder/edirae-learn bash -s -- --all
```

Or, from a clone:

```bash
bash /path/to/edirae-learn/install.sh --all
```

| Flag | Agent | What it does |
|---|---|---|
| `--claude` | Claude Code (all projects) | Copies the skill to `~/.claude/skills/` |
| `--claude-project` | Claude Code (this project) | Copies the skill to `./.claude/skills/` |
| `--agents` | Codex, Cursor, Amp, Jules and other AGENTS.md readers | Adds the instructions to `./AGENTS.md` |
| `--codex-global` | Codex (all projects) | Adds the instructions to `~/.codex/AGENTS.md` |
| `--cursor` | Cursor | Adds `./.cursor/rules/edirae-learn.mdc` |
| `--copilot` | GitHub Copilot | Adds the instructions to `./.github/copilot-instructions.md` |
| `--gemini` | Gemini CLI | Adds the instructions to `./GEMINI.md` |
| `--all` | All of the project-level options above | |
| `--uninstall` | Everything | Removes Edirae Learn (your `learn/` folder is kept) |

The installer adds its instructions between `<!-- edirae-learn:start -->` and `<!-- edirae-learn:end -->` markers, so it never touches the rest of your existing `AGENTS.md`, `GEMINI.md` or Copilot file. Running it again updates the block instead of duplicating it.

### Any other agent

Copy the contents of [`adapters/edirae-learn-instructions.md`](adapters/edirae-learn-instructions.md) into wherever your agent reads project or custom instructions (for example a rules file, system prompt or "custom instructions" setting).

---

## Use it

Just code as normal. After your agent finishes a real change, open `learn/INDEX.md` to see every breakdown, newest first.

- **Skip one:** tell your agent "skip learn" for that task.
- **Turn it off for a session:** "turn off Edirae Learn."
- **Turn it off for a project, or change the folder:** add `edirae.config.json` at the project root:

```json
{ "folder": "learn", "enabled": true }
```

- **Commit the breakdowns or not:** your choice. Committing them gives your team a readable history of why the code works the way it does. If you'd rather keep them local, add `learn/` to `.gitignore`.

---

## Coming next

- **Send to Edirae:** turn your breakdowns into lessons in [Edirae](https://edirae.com), so the concepts from your own codebase come back to you on a spaced schedule, right before you'd forget them.
- **Weekly digest:** one summary of everything your agent built this week.

---

## About Edirae

Edirae is a learning app built for the age of AI. Its AI doesn't think for you; it makes you think. It explains anything at your level, makes you explain it back, and brings it back before you forget. [edirae.com](https://edirae.com)

MIT licensed. Contributions welcome.
