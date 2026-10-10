---
name: edirae-learn
description: After writing or changing code, create a short learning breakdown file in the project's learn/ folder that explains what was built, why it was built that way, the key concept involved, and a few check-yourself questions, so the developer actually understands the code their AI agent wrote. Use this whenever you finish a coding task that adds or meaningfully changes logic (new features, bug fixes with real logic, refactors, new integrations, data models, algorithms), even if the user didn't ask for documentation. Skip trivial edits like typos, formatting, renames, version bumps, or one-line config changes.
---

# Edirae Learn

You write code for the developer. This skill makes sure they still understand it.

After you finish a coding task, write one short breakdown file that explains the change in plain language and asks the developer to think about it. The goal is not documentation for its own sake. The goal is that the human stays the one who understands their codebase.

## When to write a breakdown

Write one when the task you just finished:
- added a feature, endpoint, component, job, or integration
- fixed a bug where the fix involved real logic
- refactored code in a way that changes how it works
- introduced a pattern, library, data model, or algorithm the developer may not know

Do not write one for:
- typos, formatting, renames, comments, or dependency version bumps
- one-line config changes
- tasks where you only read or explained code without changing it

Write **one breakdown per task**, not one per file edited. If a task spans several turns, write it when the task is complete.

If the user says "skip learn", "no breakdown", or similar, skip it for that task. If they ask to turn Edirae Learn off, stop writing breakdowns for the rest of the session.

## Where to save it

- Folder: `learn/` at the root of the project. Create it if it doesn't exist.
- Filename: `YYYY-MM-DD-short-description.md` using today's date and 3-6 lowercase words joined by hyphens, for example `2026-10-10-add-payment-retry.md`. If the name is taken, add `-2`, `-3`, and so on.
- Then add one line to the top of the list in `learn/INDEX.md` (create it if needed):
  `- [YYYY-MM-DD] [Short title](filename.md): one-sentence summary`

If the project has an `edirae.config.json` file at its root, follow its settings:
```json
{ "folder": "learn", "enabled": true }
```
If `enabled` is `false`, do not write breakdowns.

Do not edit `.gitignore` or commit the files unless the user asks. Whether breakdowns are committed is the developer's choice.

## What to write

Follow the structure in `references/breakdown-template.md`. In short:

1. **Title and summary:** what was done, in 2-3 plain sentences.
2. **What changed:** each file touched and what the change does there.
3. **How it works:** the flow, step by step, as the code actually runs.
4. **Why it's built this way:** the main decisions and the alternatives you chose not to use.
5. **The concept worth knowing:** one idea the code relies on that the developer might not know. Explain it simply first, as if to a beginner, then precisely.
6. **Watch out for:** edge cases, risks, assumptions, and what to test.
7. **Check yourself:** 3 questions with answers hidden in `<details>` blocks.
8. **Explain it back:** one prompt asking the developer to describe the change in their own words.

## Rules for writing it

- **Describe what you actually wrote.** Use the real function names, file paths, and values from the code. Never describe code that doesn't exist or behaviour you didn't implement.
- **Say when you're unsure.** If part of the change is untested or based on an assumption, say so plainly in "Watch out for".
- **Plain language first.** Write for a developer who is smart but new to this part of the code. Define any term a beginner wouldn't know.
- **Keep it short.** Aim for something readable in about two minutes, roughly 300-600 words. Use short code snippets only when they make an explanation clearer, at most a few lines each.
- **Questions should make them think.** Ask "why" and "what would happen if" questions, not trivia. Good: "What would break if two requests hit `reserveSeat()` at the same time?" Weak: "What is the name of the function?"
- **No invented links.** If you suggest further reading, name the topic or the official documentation section rather than guessing at a URL.
- **No secrets.** Never copy API keys, tokens, passwords, connection strings, or personal data into the breakdown.
- **Don't change code to write the breakdown.** Writing it should never alter the implementation.

## Tell the developer

After saving the file, end your normal reply with one short line, for example:

> Breakdown saved to `learn/2026-10-10-add-payment-retry.md`. Open it to see what I did and test yourself in 2 minutes.

Keep it to that one line. Don't repeat the breakdown in the chat.

## Why this matters

AI can now write a lot of code for a developer. If they never understand it, they lose the ability to debug it, extend it, or explain it in a code review or an interview. A two-minute breakdown, with questions that make them think, keeps them in control of their own codebase.

This skill is part of Edirae, the learning app built to keep people thinking in the age of AI: edirae.com
