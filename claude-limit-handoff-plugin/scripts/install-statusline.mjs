import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? path.resolve(import.meta.dirname, "..");
const bundledScript = path.join(pluginRoot, "scripts", "claude-limit-handoff.mjs");
const stableDir = path.join(os.homedir(), ".claude", "limit-handoff");
const stableScript = path.join(stableDir, "claude-limit-handoff.mjs");
const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
const threshold = process.env.CLAUDE_PLUGIN_OPTION_threshold ?? process.env.CLAUDE_LIMIT_HANDOFF_THRESHOLD ?? "90";

fs.mkdirSync(stableDir, { recursive: true });
fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.copyFileSync(bundledScript, stableScript);

let settings = {};
if (fs.existsSync(settingsPath)) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  fs.copyFileSync(settingsPath, `${settingsPath}.bak-limit-handoff-statusline-${timestamp}`);
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
}

settings.statusLine = {
  type: "command",
  command: `${JSON.stringify(process.execPath)} ${JSON.stringify(stableScript)} statusline ${threshold}`,
  refreshInterval: 15,
  padding: 1
};

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

console.log(`Status line instalada em ${settingsPath}`);
console.log(`Script estavel copiado para ${stableScript}`);
console.log("Reinicie o Claude Code para ativar.");
