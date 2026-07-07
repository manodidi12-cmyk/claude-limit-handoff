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
const codexHome = path.join(tmp, "codex");
const codexSessions = path.join(codexHome, "sessions", "2026", "07", "07");
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(project, { recursive: true });
fs.mkdirSync(codexSessions, { recursive: true });

function run(mode, input) {
  return spawnSync(process.execPath, [cli, mode], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CLAUDE_LIMIT_HANDOFF_THRESHOLD: "90",
      CLAUDE_LIMIT_HANDOFF_STATE_DIR: stateDir,
      CODEX_HOME: codexHome
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

const codexSession = path.join(codexSessions, "rollout-test.jsonl");
fs.writeFileSync(
  codexSession,
  [
    JSON.stringify({ type: "event_msg", payload: { type: "user_message", message: "Implemente o fluxo inverso." } }),
    JSON.stringify({ type: "event_msg", payload: { type: "agent_message", message: "Vou criar o handoff do Codex para o Claude." } }),
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "token_count",
        rate_limits: {
          primary: { used_percent: 92, window_minutes: 300, resets_at: 1893456000 },
          secondary: { used_percent: 8, window_minutes: 10080, resets_at: 1893974400 }
        }
      }
    })
  ].join("\n"),
  "utf8"
);

const codexStatus = run("codex-status", {});
assert.equal(codexStatus.status, 0);
assert.match(codexStatus.stdout, /"used_percent": 92/);

const codexCheck = run("codex-check", {});
assert.equal(codexCheck.status, 0);
assert.match(codexCheck.stdout, /CODEX_TO_CLAUDE_HANDOFF\.md/);

const codexHandoff = run("codex-to-claude", {});
assert.equal(codexHandoff.status, 0);
const codexHandoffPath = path.join(project, "CODEX_TO_CLAUDE_HANDOFF.md");
assert.ok(fs.existsSync(codexHandoffPath));
assert.match(fs.readFileSync(codexHandoffPath, "utf8"), /Continue a partir do arquivo CODEX_TO_CLAUDE_HANDOFF\.md/);

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

const expiredStateDir = path.join(tmp, "state-expired");
fs.mkdirSync(expiredStateDir, { recursive: true });
fs.writeFileSync(
  path.join(expiredStateDir, "state.json"),
  JSON.stringify({
    limits: {
      fiveHour: { usedPercentage: 100, resetsAt: Math.floor(Date.now() / 1000) - 60 },
      sevenDay: { usedPercentage: 79, resetsAt: Math.floor(Date.now() / 1000) - 60 }
    }
  }),
  "utf8"
);

const expiredStatus = spawnSync(process.execPath, [cli, "statusline"], {
  input: JSON.stringify({ workspace: { current_dir: project } }),
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    CLAUDE_LIMIT_HANDOFF_STATE_DIR: expiredStateDir
  },
  cwd: project
});
assert.equal(expiredStatus.status, 0);
assert.match(expiredStatus.stdout, /5h 0%/);
assert.match(expiredStatus.stdout, /7d 0%/);
assert.match(expiredStatus.stdout, /OK 90%/);

const expiredHook = spawnSync(process.execPath, [cli, "hook", "90"], {
  input: JSON.stringify({ hook_event_name: "PreToolUse", cwd: project }),
  encoding: "utf8",
  env: {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    CLAUDE_LIMIT_HANDOFF_STATE_DIR: expiredStateDir
  },
  cwd: project
});
assert.equal(expiredHook.status, 0);
assert.equal(expiredHook.stdout, "");

console.log("ok");
