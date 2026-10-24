import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const INSTALLER = fileURLToPath(new URL("../install.sh", import.meta.url));
const REPO_DIR = dirname(INSTALLER);
const START_MARK = "<!-- edirae-learn:start -->";

const BLOCK_FILES = ["AGENTS.md", ".github/copilot-instructions.md", "GEMINI.md"];
const ALL_TARGETS = [
  ".claude/skills/edirae-learn/SKILL.md",
  ".cursor/rules/edirae-learn.mdc",
  ...BLOCK_FILES,
];

// Every run gets its own project folder and its own HOME, so --uninstall
// (which also cleans ~/.claude and ~/.codex) never touches the real ones.
const sandbox = () => {
  const root = mkdtempSync(join(tmpdir(), "edirae-learn-install-"));
  const project = join(root, "project");
  const home = join(root, "home");
  mkdirSync(project);
  mkdirSync(home);
  return { root, project, home };
};

const install = ({ project, home }, ...args) => {
  const env = { ...process.env, HOME: home };
  delete env.EDIRAE_LEARN_REPO;
  delete env.EDIRAE_LEARN_BRANCH;
  const res = spawnSync("bash", [INSTALLER, ...args], { cwd: project, env, encoding: "utf8" });
  assert.equal(res.status, 0, `install.sh ${args.join(" ")} failed:\n${res.stderr}${res.stdout}`);
  return res;
};

const read = (project, file) => readFileSync(join(project, file), "utf8");
const count = (text, needle) => text.split(needle).length - 1;

describe("install.sh", () => {
  test("is valid bash with no leftover placeholders or conflict markers", () => {
    const syntax = spawnSync("bash", ["-n", INSTALLER], { encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);

    const source = readFileSync(INSTALLER, "utf8");
    assert.doesNotMatch(source, /^(<{7}|={7}|>{7})/m);
    assert.doesNotMatch(source, /YOUR-GITHUB-USER/);
  });

  test("--all creates every target", () => {
    const box = sandbox();
    install(box, "--all");

    for (const file of ALL_TARGETS) {
      assert.ok(existsSync(join(box.project, file)), `missing ${file}`);
    }
    for (const file of BLOCK_FILES) {
      assert.equal(count(read(box.project, file), START_MARK), 1, `${file} should hold one block`);
    }
  });

  test("a second run does not duplicate the marker block", () => {
    const box = sandbox();
    install(box, "--all");
    const first = Object.fromEntries(BLOCK_FILES.map((f) => [f, read(box.project, f)]));

    install(box, "--all");

    for (const file of BLOCK_FILES) {
      const text = read(box.project, file);
      assert.equal(count(text, START_MARK), 1, `${file} has a duplicated block`);
      assert.equal(text, first[file], `${file} changed on the second run`);
    }
  });

  test("keeps existing AGENTS.md content", () => {
    const box = sandbox();
    const existing = "# My project\n\nAlways run the linter before committing.\n";
    writeFileSync(join(box.project, "AGENTS.md"), existing);

    install(box, "--agents");
    install(box, "--agents");

    const text = read(box.project, "AGENTS.md");
    assert.ok(text.startsWith(existing), "original AGENTS.md content was changed");
    assert.equal(count(text, START_MARK), 1);
  });

  test("--uninstall removes only Edirae Learn and keeps learn/", () => {
    const box = sandbox();
    const p = (f) => join(box.project, f);
    const agents = "# My project\n\nAlways run the linter before committing.\n";
    writeFileSync(p("AGENTS.md"), agents);
    mkdirSync(p("learn"));
    writeFileSync(p("learn/INDEX.md"), "- [2026-10-10] [Old breakdown](x.md): kept\n");
    writeFileSync(p("learn/2026-10-10-x.md"), "# Old breakdown\n");
    mkdirSync(p(".claude/skills/other-skill"), { recursive: true });
    writeFileSync(p(".claude/skills/other-skill/SKILL.md"), "other");
    mkdirSync(p(".cursor/rules"), { recursive: true });
    writeFileSync(p(".cursor/rules/other.mdc"), "other rule");

    install(box, "--all");
    install(box, "--uninstall");

    assert.ok(!existsSync(p(".claude/skills/edirae-learn")), "skill not removed");
    assert.ok(!existsSync(p(".cursor/rules/edirae-learn.mdc")), "cursor rule not removed");
    for (const file of BLOCK_FILES) {
      assert.equal(count(read(box.project, file), START_MARK), 0, `${file} still has the block`);
    }
    assert.equal(read(box.project, "AGENTS.md").trimEnd(), agents.trimEnd());

    assert.equal(read(box.project, "learn/2026-10-10-x.md"), "# Old breakdown\n");
    assert.ok(existsSync(p("learn/INDEX.md")));
    assert.equal(read(box.project, ".claude/skills/other-skill/SKILL.md"), "other");
    assert.equal(read(box.project, ".cursor/rules/other.mdc"), "other rule");
  });

  test("piped install (curl | bash) downloads eloquentcoder/edirae-learn with no env vars", () => {
    const box = sandbox();

    // Stand-in for curl: log the URL and serve a tarball of this clone,
    // the way codeload.github.com would, so the test runs offline.
    const bin = join(box.root, "bin");
    const log = join(box.root, "curl.log");
    mkdirSync(bin);
    writeFileSync(
      join(bin, "curl"),
      `#!/usr/bin/env bash\necho "$@" >> "${log}"\n` +
        `tar -cz --exclude .git -C "${dirname(REPO_DIR)}" "${basename(REPO_DIR)}"\n`,
    );
    chmodSync(join(bin, "curl"), 0o755);

    const env = { ...process.env, HOME: box.home, PATH: `${bin}:${process.env.PATH}` };
    delete env.EDIRAE_LEARN_REPO;
    delete env.EDIRAE_LEARN_BRANCH;
    const res = spawnSync("bash", ["-s", "--", "--agents"], {
      cwd: box.project,
      env,
      input: readFileSync(INSTALLER),
      encoding: "utf8",
    });

    assert.equal(res.status, 0, res.stderr + res.stdout);
    assert.match(
      readFileSync(log, "utf8"),
      /codeload\.github\.com\/eloquentcoder\/edirae-learn\/tar\.gz\/refs\/heads\/master/,
    );
    assert.equal(count(read(box.project, "AGENTS.md"), START_MARK), 1);
  });
});
