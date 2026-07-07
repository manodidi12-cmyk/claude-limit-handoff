import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const settingsPath = path.join(os.homedir(), ".claude", "settings.json");

if (!fs.existsSync(settingsPath)) {
  console.log("settings.json nao encontrado.");
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
fs.copyFileSync(settingsPath, `${settingsPath}.bak-limit-handoff-uninstall-${timestamp}`);

const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

if (settings.statusLine && JSON.stringify(settings.statusLine).includes("claude-limit-handoff.mjs")) {
  delete settings.statusLine;
}

if (settings.hooks && typeof settings.hooks === "object") {
  for (const eventName of Object.keys(settings.hooks)) {
    settings.hooks[eventName] = (Array.isArray(settings.hooks[eventName]) ? settings.hooks[eventName] : []).filter((group) => {
      return !JSON.stringify(group).includes("claude-limit-handoff.mjs");
    });
    if (settings.hooks[eventName].length === 0) {
      delete settings.hooks[eventName];
    }
  }
}

fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
console.log("Removido. Backup criado ao lado do settings.json.");
