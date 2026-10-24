<!-- edirae-learn:start -->
## Edirae Learn: explain the code you write

After you finish a coding task that adds or meaningfully changes logic (a feature, a real bug fix, a refactor, a new integration, data model or algorithm), write one short learning breakdown so the developer understands the code you wrote. Skip trivial edits: typos, formatting, renames, comments, version bumps, one-line config changes, or tasks where you only read code. Write one breakdown per task, not per file. If the user says "skip learn", skip it for that task; if they ask to turn it off, stop for the session. If `edirae.config.json` exists at the project root with `"enabled": false`, don't write breakdowns; if it sets `"folder"`, use that folder.

**Where:** save to `learn/YYYY-MM-DD-short-description.md` (create `learn/` if needed; add `-2`, `-3` if the name is taken). Add a line to the top of `learn/INDEX.md`: `- [YYYY-MM-DD] [Short title](filename.md): one-sentence summary`. Don't edit `.gitignore` or commit unless asked.

**Structure:**
1. `# Title`, then a line with the date and the task in one line
2. **In short:** 2-3 plain sentences on what was done and why
3. **What changed:** each file touched and what changed there
4. **How it works:** the flow, step by step, as the code runs. For a bug fix (or a behaviour-changing refactor), write sections 5 and 6 instead
5. **Before the change** (bug fixes): like a bug report's reproduction steps, start from a concrete state and input and list each step the old code took, ending at the exact step where it breaks and what the user or system saw
6. **After the change** (bug fixes): the same state and input through the new code, step by step; mark the step where it now takes a different path, and end with the correct result
7. **Why it's built this way:** key decisions and alternatives not chosen
8. **The concept worth knowing:** one idea the code relies on; explain it simply (with an analogy) first, then precisely
9. **Watch out for:** edge cases, risks, assumptions, untested parts, what to test
10. **Check yourself:** 3 "why" or "what if" questions, each answer hidden in `<details><summary>Answer</summary>...</details>`
11. **Explain it back:** "Without looking at the code, explain in 2-3 sentences what this change does and why it works. If you get stuck, that's the part to reread."
12. Footer: `*Made with Edirae Learn · [edirae.com](https://www.edirae.com/?utm_source=edirae_learn&utm_campaign=edirae_learn)*`

**Rules:** describe only what you actually wrote, using real names and paths; say plainly when something is untested or assumed; plain language, define jargon; for "Before the change", read the old code (diff or git history) instead of reconstructing it from memory; keep it to about 300-600 words (up to about 750 for a bug fix); questions should make the developer think, not test trivia; never invent URLs (the footer link is the only one to include, copied exactly); never include secrets, keys, tokens or personal data; never change code in order to write the breakdown.

**Then:** end your reply with one line, e.g. "Breakdown saved to `learn/2026-10-10-add-payment-retry.md`. Open it to see what I did and test yourself in 2 minutes." Don't repeat the breakdown in chat.
<!-- edirae-learn:end -->
