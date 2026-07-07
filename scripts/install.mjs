import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const threshold = Number(process.argv[2] ?? "90");
const safeThreshold = Number.isFinite(threshold) && threshold > 0 ? Math.round(threshold) : 90;
const root = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(root, "src", "claude-limit-handoff.mjs");
const nodePath = process.execPath;
const claudeDir = path.join(os.homedir(), ".claude");
const settingsPath = path.join(claudeDir, "settings.json");

fs.mkdirSync(claudeDir, { recursive: true });

let settings = {};
if (fs.existsSync(settingsPath)) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  fs.copyFileSync(settingsPath, `${settingsPath}.bak-limit-handoff-${timestamp}`);
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
}

settings.hooks ??= {};

const hookCommand = {
  type: "command",
  command: nodePath,
  args: [scriptPath, "hook", String(safeThreshold)],
  timeout: 5
};

function removeExisting(groups) {
  return (Array.isArray(groups) ? groups : []).filter((group) => {
    return !JSON.stringify(group).includes("claude-limit-handoff.mjs");
  });
}

function addHook(eventName, matcher = null) {
  const group = { hooks: [hookCommand] };
  if (matcher) group.matcher = matcher;
  settings.hooks[eventName] = [...removeExisting(settings.hooks[eventName]), group];
}

addHook("PreToolUse", "*");
addHook("UserPromptSubmit");
addHook("Stop");
addHook("StopFailure", "rate_limit");

settings.statusLine = {
  type: "command",
  command: `${JSON.stringify(nodePath)} ${JSON.stringify(scriptPath)} statusline ${safeThreshold}`,
  refreshInterval: 15,
  padding: 1
};

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

console.log(`Instalado em ${settingsPath}`);
console.log(`Threshold: ${safeThreshold}%`);
console.log("Reinicie o Claude Code para carregar os hooks/statusLine.");
