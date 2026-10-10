#!/usr/bin/env node
// Edirae Learn Stop hook for Claude Code.
//
// Runs when Claude is about to end its turn. If Claude changed code in the
// project during this turn but did not save a breakdown in the learn folder,
// it blocks the stop and asks Claude to write one. Everything else (no code
// changes, docs-only or tiny edits, "skip learn", a disabled config, any
// error) lets Claude stop normally. It never fails the session.

import { readFileSync, existsSync } from "node:fs";
import { resolve, relative, extname, isAbsolute, sep, join } from "node:path";
import { pathToFileURL } from "node:url";

// Edits smaller than this (in changed lines) count as trivial.
const MIN_LINES = 5;

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const DOC_EXTENSIONS = new Set([
  ".md", ".mdx", ".markdown", ".txt", ".rst", ".adoc", ".log", ".lock",
]);
const SKIP_PATTERN = /\b(skip learn|no breakdown|without (a )?breakdown)\b/i;
const OFF_PATTERN =
  /\b(turn off edirae learn|turn edirae learn off|disable edirae learn|stop writing breakdowns|turn (learn|breakdowns) off|turn off (learn|breakdowns))\b/i;

const countLines = (text) => (typeof text === "string" && text.length ? text.split("\n").length : 0);

const isCommandText = (text) =>
  text.startsWith("<local-command") || text.startsWith("<command-");

// Text of an entry that starts a new turn (a prompt from the developer, or an
// injected one like a background-task notification), or null for tool
// results, meta entries and slash-command output.
function turnText(entry) {
  if (entry?.type !== "user" || entry.isMeta) return null;
  const content = entry.message?.content;
  if (typeof content === "string") return isCommandText(content) ? null : content;
  if (!Array.isArray(content)) return null;
  if (content.some((block) => block?.type === "tool_result")) return null;
  const text = content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
  return text && !isCommandText(text) ? text : null;
}

const isHuman = (entry) => !entry.origin || entry.origin.kind === "human";

function toolUses(entry) {
  if (entry?.type !== "assistant") return [];
  const content = entry.message?.content;
  return Array.isArray(content) ? content.filter((block) => block?.type === "tool_use") : [];
}

function changedLines(name, input) {
  switch (name) {
    case "Write":
      return countLines(input.content);
    case "Edit":
      return Math.max(countLines(input.old_string), countLines(input.new_string));
    case "MultiEdit":
      return (input.edits ?? []).reduce(
        (sum, e) => sum + Math.max(countLines(e?.old_string), countLines(e?.new_string)),
        0
      );
    case "NotebookEdit":
      return countLines(input.new_source);
    default:
      return 0;
  }
}

function loadConfig(projectDir) {
  const file = join(projectDir, "edirae.config.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) ?? {};
  } catch {
    return {};
  }
}

const isInside = (rel) => rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);

/**
 * Decide whether to block Claude from stopping.
 * Returns { decision: "block", reason } or null to allow the stop.
 */
export function decide({ input, entries, projectDir, today }) {
  if (input?.stop_hook_active) return null;

  const config = loadConfig(projectDir);
  if (config.enabled === false) return null;
  const folder = String(config.folder || "learn").replace(/^\/+|\/+$/g, "");
  const learnDir = resolve(projectDir, folder);

  let turnStart = -1;
  let lastHumanPrompt = "";
  for (let i = 0; i < entries.length; i++) {
    const text = turnText(entries[i]);
    if (text === null) continue;
    turnStart = i;
    if (!isHuman(entries[i])) continue;
    if (OFF_PATTERN.test(text)) return null;
    lastHumanPrompt = text;
  }
  if (turnStart === -1) return null;
  if (SKIP_PATTERN.test(lastHumanPrompt)) return null;

  let codeLines = 0;
  const codeFiles = new Set();
  for (const entry of entries.slice(turnStart + 1)) {
    for (const use of toolUses(entry)) {
      if (!EDIT_TOOLS.has(use.name)) continue;
      const input = use.input ?? {};
      const target = input.file_path ?? input.notebook_path;
      if (typeof target !== "string" || !target) continue;

      const abs = resolve(projectDir, target);
      const inLearn = relative(learnDir, abs);
      if (isInside(inLearn)) {
        const isBreakdown = extname(abs) === ".md" && inLearn !== "INDEX.md";
        if (isBreakdown) return null;
        continue;
      }

      const rel = relative(projectDir, abs);
      if (!isInside(rel)) continue;
      if (rel.split(sep)[0] === ".git") continue;
      if (DOC_EXTENSIONS.has(extname(abs).toLowerCase())) continue;

      codeLines += changedLines(use.name, input);
      codeFiles.add(rel.split(sep).join("/"));
    }
  }

  if (codeLines < MIN_LINES) return null;

  const files = [...codeFiles].slice(0, 8).join(", ") + (codeFiles.size > 8 ? ", ..." : "");
  return {
    decision: "block",
    reason:
      `Edirae Learn: you changed code in this task (${files}) but no breakdown was saved in ${folder}/. ` +
      `If this was a meaningful change, use the edirae-learn skill now: write ${folder}/${today}-short-description.md ` +
      `and add its line to the top of ${folder}/INDEX.md, then end with the one-line "Breakdown saved to ..." note. ` +
      `If the change was trivial (typo, rename, formatting, one-line config) or the task is not finished yet, ` +
      `do not write one; just finish your reply.`,
  };
}

function readEntries(transcriptPath) {
  if (typeof transcriptPath !== "string" || !existsSync(transcriptPath)) return [];
  const entries = [];
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // ignore partial or malformed lines
    }
  }
  return entries;
}

function localDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  const result = decide({
    input,
    entries: readEntries(input.transcript_path),
    projectDir,
    today: localDate(),
  });
  if (result) process.stdout.write(JSON.stringify(result));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => {}).finally(() => process.exit(0));
}
