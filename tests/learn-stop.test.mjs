import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { decide } from "../hooks/learn-stop.mjs";

const HOOK = fileURLToPath(new URL("../hooks/learn-stop.mjs", import.meta.url));

// ---- transcript builders (shapes match Claude Code's session .jsonl) ----
const prompt = (text) => ({
  type: "user",
  origin: { kind: "human" },
  message: { role: "user", content: text },
});
const toolUse = (name, input) => ({
  type: "assistant",
  message: { role: "assistant", content: [{ type: "tool_use", name, input }] },
});
const toolResult = () => ({
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", content: "ok" }] },
});
const lines = (n) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n");

const project = () => mkdtempSync(join(tmpdir(), "edirae-learn-"));

const run = (projectDir, entries, extra = {}) =>
  decide({
    input: { stop_hook_active: false, cwd: projectDir, ...extra },
    entries,
    projectDir,
    today: "2026-10-10",
  });

describe("decide", () => {
  test("blocks when code changed and no breakdown was written", () => {
    const dir = project();
    const result = run(dir, [
      prompt("add retry to payments"),
      toolUse("Write", { file_path: join(dir, "src/pay.js"), content: lines(20) }),
      toolResult(),
    ]);
    assert.equal(result?.decision, "block");
    assert.match(result.reason, /edirae-learn/);
    assert.match(result.reason, /src\/pay\.js/);
    assert.match(result.reason, /learn\/2026-10-10-/);
  });

  test("allows the stop and tells the user when a breakdown was written", () => {
    const dir = project();
    const result = run(dir, [
      prompt("add retry to payments"),
      toolUse("Write", { file_path: join(dir, "src/pay.js"), content: lines(20) }),
      toolResult(),
      toolUse("Write", { file_path: join(dir, "learn/2026-10-10-add-retry.md"), content: lines(30) }),
      toolResult(),
    ]);
    assert.equal(result?.decision, undefined);
    assert.match(result?.systemMessage, /Edirae Learn/);
    assert.match(result.systemMessage, /learn\/2026-10-10-add-retry\.md/);
  });

  test("still tells the user after the hook asked for the breakdown", () => {
    const dir = project();
    const result = run(
      dir,
      [
        prompt("add retry"),
        toolUse("Write", { file_path: join(dir, "src/pay.js"), content: lines(20) }),
        toolUse("Write", { file_path: join(dir, "learn/2026-10-10-add-retry.md"), content: lines(30) }),
      ],
      { stop_hook_active: true }
    );
    assert.match(result?.systemMessage, /learn\/2026-10-10-add-retry\.md/);
  });

  test("the hook's own request in the transcript does not read as 'skip learn'", () => {
    const dir = project();
    const first = run(dir, [
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "src/pay.js"), content: lines(20) }),
    ]);
    const result = run(
      dir,
      [
        prompt("add retry"),
        toolUse("Write", { file_path: join(dir, "src/pay.js"), content: lines(20) }),
        { type: "user", message: { content: `Stop hook feedback:\n${first.reason}` } },
        toolUse("Write", { file_path: join(dir, "learn/2026-10-10-add-retry.md"), content: lines(30) }),
      ],
      { stop_hook_active: true }
    );
    assert.match(result?.systemMessage, /learn\/2026-10-10-add-retry\.md/);
  });

  test("lists every breakdown written in the turn", () => {
    const dir = project();
    const result = run(dir, [
      prompt("two things"),
      toolUse("Write", { file_path: join(dir, "learn/2026-10-10-one.md"), content: lines(30) }),
      toolUse("Write", { file_path: join(dir, "learn/2026-10-10-two.md"), content: lines(30) }),
      toolUse("Edit", { file_path: join(dir, "learn/2026-10-10-two.md"), old_string: "a", new_string: "b" }),
    ]);
    assert.match(result.systemMessage, /2026-10-10-one\.md/);
    assert.match(result.systemMessage, /2026-10-10-two\.md/);
    assert.equal(result.systemMessage.match(/two\.md/g).length, 1);
  });

  test("does not announce breakdowns from an earlier turn", () => {
    const dir = project();
    const result = run(dir, [
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "learn/2026-10-10-add-retry.md"), content: lines(30) }),
      prompt("thanks, push it"),
    ]);
    assert.equal(result, null);
  });

  test("writing only INDEX.md does not count as a breakdown", () => {
    const dir = project();
    const result = run(dir, [
      prompt("add retry"),
      toolUse("Edit", { file_path: join(dir, "src/pay.js"), old_string: "a", new_string: lines(10) }),
      toolUse("Edit", { file_path: join(dir, "learn/INDEX.md"), old_string: "", new_string: "- x" }),
    ]);
    assert.equal(result?.decision, "block");
  });

  test("allows when stop_hook_active is set, so it never loops", () => {
    const dir = project();
    const result = run(
      dir,
      [prompt("x"), toolUse("Write", { file_path: join(dir, "a.ts"), content: lines(20) })],
      { stop_hook_active: true }
    );
    assert.equal(result, null);
  });

  test("ignores documentation-only edits", () => {
    const dir = project();
    const result = run(dir, [
      prompt("update docs"),
      toolUse("Write", { file_path: join(dir, "README.md"), content: lines(50) }),
      toolUse("Write", { file_path: join(dir, "notes.txt"), content: lines(50) }),
    ]);
    assert.equal(result, null);
  });

  test("ignores tiny edits below the line threshold", () => {
    const dir = project();
    const result = run(dir, [
      prompt("fix typo"),
      toolUse("Edit", { file_path: join(dir, "src/a.js"), old_string: "teh", new_string: "the" }),
    ]);
    assert.equal(result, null);
  });

  test("counts MultiEdit and NotebookEdit changes", () => {
    const dir = project();
    const multi = run(dir, [
      prompt("refactor"),
      toolUse("MultiEdit", {
        file_path: join(dir, "src/a.py"),
        edits: [
          { old_string: "a", new_string: lines(3) },
          { old_string: "b", new_string: lines(3) },
        ],
      }),
    ]);
    assert.equal(multi?.decision, "block");

    const nb = run(dir, [
      prompt("add cell"),
      toolUse("NotebookEdit", { notebook_path: join(dir, "nb.ipynb"), new_source: lines(8) }),
    ]);
    assert.equal(nb?.decision, "block");
  });

  test("ignores files outside the project folder", () => {
    const dir = project();
    const result = run(dir, [
      prompt("save memory"),
      toolUse("Write", { file_path: "/tmp/elsewhere/scratch.js", content: lines(40) }),
    ]);
    assert.equal(result, null);
  });

  test("only looks at the current turn", () => {
    const dir = project();
    const result = run(dir, [
      prompt("build feature"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
      toolResult(),
      prompt("what does this function do?"),
      toolUse("Read", { file_path: join(dir, "src/a.js") }),
      toolResult(),
    ]);
    assert.equal(result, null);
  });

  test("tool results do not start a new turn", () => {
    const dir = project();
    const result = run(dir, [
      prompt("build feature"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
      toolResult(),
      toolUse("Read", { file_path: join(dir, "src/a.js") }),
      toolResult(),
    ]);
    assert.equal(result?.decision, "block");
  });

  test("slash-command and meta entries do not start a new turn", () => {
    const dir = project();
    const result = run(dir, [
      prompt("build feature"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
      { type: "user", isMeta: true, message: { content: "<local-command-caveat>x" } },
      { type: "user", message: { content: "<command-name>/plugin</command-name>" } },
    ]);
    assert.equal(result?.decision, "block");
  });

  test("a background task notification starts a new turn", () => {
    const dir = project();
    const notification = {
      type: "user",
      origin: { kind: "task-notification" },
      message: { content: "<task-notification>agent finished</task-notification>" },
    };
    const result = run(dir, [
      prompt("build feature"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
      toolResult(),
      notification,
    ]);
    assert.equal(result, null);

    const edited = run(dir, [
      prompt("build feature"),
      notification,
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
    ]);
    assert.equal(edited?.decision, "block");
  });

  test("'skip learn' in the human prompt still applies after a notification", () => {
    const dir = project();
    const result = run(dir, [
      prompt("build feature, skip learn"),
      { type: "user", origin: { kind: "task-notification" }, message: { content: "<task-notification>x" } },
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
    ]);
    assert.equal(result, null);
  });

  test("respects 'skip learn' in the current prompt", () => {
    const dir = project();
    const result = run(dir, [
      prompt("add retry, skip learn"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
    ]);
    assert.equal(result, null);
  });

  test("respects turning Edirae Learn off earlier in the session", () => {
    const dir = project();
    const result = run(dir, [
      prompt("turn off Edirae Learn for now"),
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
    ]);
    assert.equal(result, null);
  });

  test("respects edirae.config.json enabled:false", () => {
    const dir = project();
    writeFileSync(join(dir, "edirae.config.json"), JSON.stringify({ enabled: false }));
    const result = run(dir, [
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
    ]);
    assert.equal(result, null);
  });

  test("uses the folder from edirae.config.json", () => {
    const dir = project();
    writeFileSync(join(dir, "edirae.config.json"), JSON.stringify({ folder: "docs/learn" }));
    const blocked = run(dir, [
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
    ]);
    assert.match(blocked.reason, /docs\/learn\/2026-10-10-/);

    const allowed = run(dir, [
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
      toolUse("Write", { file_path: join(dir, "docs/learn/2026-10-10-retry.md"), content: lines(30) }),
    ]);
    assert.equal(allowed.decision, undefined);
    assert.match(allowed.systemMessage, /docs\/learn\/2026-10-10-retry\.md/);
  });

  test("accepts relative file paths", () => {
    const dir = project();
    const result = run(dir, [
      prompt("add retry"),
      toolUse("Write", { file_path: "src/a.js", content: lines(40) }),
    ]);
    assert.equal(result?.decision, "block");
  });
});

describe("hook process", () => {
  const invoke = (payload) =>
    spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: "utf8" });

  test("prints a block decision as JSON on stdout", () => {
    const dir = project();
    const transcript = join(dir, "session.jsonl");
    const entries = [
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "src/a.js"), content: lines(40) }),
    ];
    writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join("\n") + "\n{not json\n");
    const res = invoke({ transcript_path: transcript, cwd: dir, stop_hook_active: false });
    assert.equal(res.status, 0);
    assert.equal(JSON.parse(res.stdout).decision, "block");
  });

  test("prints the saved-breakdown notice as JSON on stdout", () => {
    const dir = project();
    const transcript = join(dir, "session.jsonl");
    const entries = [
      prompt("add retry"),
      toolUse("Write", { file_path: join(dir, "learn/2026-10-10-retry.md"), content: lines(30) }),
    ];
    writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join("\n"));
    const res = invoke({ transcript_path: transcript, cwd: dir, stop_hook_active: true });
    assert.equal(res.status, 0);
    assert.match(JSON.parse(res.stdout).systemMessage, /learn\/2026-10-10-retry\.md/);
  });

  test("prints nothing when there is nothing to do", () => {
    const dir = project();
    const transcript = join(dir, "session.jsonl");
    writeFileSync(transcript, JSON.stringify(prompt("hi")) + "\n");
    const res = invoke({ transcript_path: transcript, cwd: dir, stop_hook_active: false });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
  });

  test("never fails the session on bad input", () => {
    const res = spawnSync(process.execPath, [HOOK], { input: "garbage", encoding: "utf8" });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
    const missing = invoke({ transcript_path: "/nope/missing.jsonl", cwd: "/nope" });
    assert.equal(missing.status, 0);
    assert.equal(missing.stdout, "");
  });
});
