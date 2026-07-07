import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "src", "claude-limit-handoff.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "limit-handoff-test-"));
const home = path.join(tmp, "home");
const project = path.join(tmp, "project");
const stateDir = path.join(tmp, "state");
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(project, { recursive: true });

function run(mode, input) {
  return spawnSync(process.execPath, [cli, mode], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CLAUDE_LIMIT_HANDOFF_THRESHOLD: "90",
      CLAUDE_LIMIT_HANDOFF_STATE_DIR: stateDir
    },
    cwd: project
  });
}

const status = run("statusline", {
  model: { display_name: "Opus" },
  workspace: { current_dir: project },
  session_id: "session-1",
  rate_limits: {
    five_hour: { used_percentage: 91, resets_at: 1893456000 },
    seven_day: { used_percentage: 12, resets_at: 1893974400 }
  }
});

assert.equal(status.status, 0);
assert.match(status.stdout, /5h 91%/);

const hook = run("hook", {
  hook_event_name: "PreToolUse",
  cwd: project,
  session_id: "session-1",
  tool_name: "Bash",
  tool_input: { command: "npm test" }
});

assert.equal(hook.status, 0);
assert.match(hook.stdout, /permissionDecision/);
assert.ok(fs.existsSync(path.join(project, "CLAUDE_TO_CODEX_HANDOFF.md")));

const belowHome = path.join(tmp, "home-below");
const belowState = path.join(tmp, "state-below");
fs.mkdirSync(belowHome, { recursive: true });
const below = spawnSync(process.execPath, [cli, "statusline"], {
  input: JSON.stringify({
    workspace: { current_dir: project },
    rate_limits: { five_hour: { used_percentage: 10 } }
  }),
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: belowHome,
    USERPROFILE: belowHome,
    CLAUDE_LIMIT_HANDOFF_STATE_DIR: belowState
  }
});
assert.equal(below.status, 0);

console.log("ok");
