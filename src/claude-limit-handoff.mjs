#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_THRESHOLD = 90;
const STATE_DIR = process.env.CLAUDE_LIMIT_HANDOFF_STATE_DIR
  ? path.resolve(process.env.CLAUDE_LIMIT_HANDOFF_STATE_DIR)
  : path.join(os.homedir(), ".claude", "limit-handoff");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const LOG_FILE = path.join(STATE_DIR, "events.log");
const HANDOFF_NAME = "CLAUDE_TO_CODEX_HANDOFF.md";
const CODEX_HANDOFF_NAME = "CODEX_TO_CLAUDE_HANDOFF.md";

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseJson(text, fallback = {}) {
  if (!text || !text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function getThreshold() {
  const thresholdFlagIndex = process.argv.findIndex((arg) => arg === "--threshold" || arg === "-t");
  const fromFlag = thresholdFlagIndex >= 0 ? Number(process.argv[thresholdFlagIndex + 1]) : null;
  if (Number.isFinite(fromFlag) && fromFlag > 0) return fromFlag;

  const fromArg = process.argv[3] ? Number(process.argv[3]) : null;
  if (Number.isFinite(fromArg) && fromArg > 0) return fromArg;

  const raw = process.env.CLAUDE_LIMIT_HANDOFF_THRESHOLD;
  const value = raw ? Number(raw) : DEFAULT_THRESHOLD;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_THRESHOLD;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getCwd(input) {
  const candidates = [
    input.cwd,
    input.workspace?.current_dir,
    input.workspace?.cwd,
    input.project_dir,
    input.projectDir,
    process.env.CLAUDE_PROJECT_DIR,
    process.cwd()
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string") return path.resolve(candidate);
  }
  return process.cwd();
}

function unixSecondsToLocalTime(seconds) {
  const value = toNumber(seconds);
  if (value === null) return "--";
  return new Date(value * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function compactPercent(value) {
  const number = toNumber(value);
  return number === null ? null : Math.round(number);
}

function extractLimits(input) {
  const five = input.rate_limits?.five_hour ?? input.rateLimits?.fiveHour ?? {};
  const week = input.rate_limits?.seven_day ?? input.rateLimits?.sevenDay ?? {};
  return {
    fiveHour: {
      usedPercentage: toNumber(five.used_percentage ?? five.usedPercentage),
      resetsAt: toNumber(five.resets_at ?? five.resetsAt)
    },
    sevenDay: {
      usedPercentage: toNumber(week.used_percentage ?? week.usedPercentage),
      resetsAt: toNumber(week.resets_at ?? week.resetsAt)
    }
  };
}

function mergeLimitWindow(previous = {}, current = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
  const currentUsed = current.usedPercentage;
  const currentReset = current.resetsAt;
  const previousReset = toNumber(previous.resetsAt);

  if (currentUsed !== null || currentReset !== null) {
    return {
      usedPercentage: currentUsed ?? previous.usedPercentage ?? null,
      resetsAt: currentReset ?? previous.resetsAt ?? null
    };
  }

  if (previousReset !== null && previousReset <= nowSeconds) {
    return {
      usedPercentage: 0,
      resetsAt: null
    };
  }

  return {
    usedPercentage: previous.usedPercentage ?? null,
    resetsAt: previous.resetsAt ?? null
  };
}

function mergeLimits(previous = {}, current = {}) {
  return {
    fiveHour: mergeLimitWindow(previous.fiveHour, current.fiveHour),
    sevenDay: mergeLimitWindow(previous.sevenDay, current.sevenDay)
  };
}

function loadState() {
  return parseJson(fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE, "utf8") : "", {});
}

function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function logEvent(event) {
  ensureStateDir();
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  fs.appendFileSync(LOG_FILE, `${line}\n`, "utf8");
}

function runGit(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000
    }).trim();
  } catch {
    return "";
  }
}

function getCodexHome() {
  return process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), ".codex");
}

function listFilesRecursive(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function findLatestCodexSession() {
  const sessionsDir = path.join(getCodexHome(), "sessions");
  const files = listFilesRecursive(sessionsDir).filter((file) => file.endsWith(".jsonl"));
  if (!files.length) return null;

  return files
    .map((file) => {
      try {
        return { file, mtimeMs: fs.statSync(file).mtimeMs };
      } catch {
        return { file, mtimeMs: 0 };
      }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].file;
}

function parseContentBlocks(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item?.text === "string") return item.text;
      if (typeof item?.input_text === "string") return item.input_text;
      if (typeof item?.output_text === "string") return item.output_text;
      if (item?.type === "input_text" && typeof item.text === "string") return item.text;
      if (item?.type === "output_text" && typeof item.text === "string") return item.text;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function readCodexSession(sessionPath) {
  const resolvedPath = sessionPath && fs.existsSync(sessionPath) ? sessionPath : findLatestCodexSession();
  if (!resolvedPath) {
    return { sessionPath: null, messages: [], rateLimits: null };
  }

  const text = fs.readFileSync(resolvedPath, "utf8");
  const lines = text.trim().split(/\r?\n/).slice(-300);
  const messages = [];
  let rateLimits = null;

  for (const line of lines) {
    const entry = parseJson(line, null);
    if (!entry) continue;

    const payload = entry.payload ?? {};
    if (payload.rate_limits) {
      rateLimits = payload.rate_limits;
    }

    if (payload.type === "user_message" && typeof payload.message === "string") {
      messages.push({ role: "user", content: payload.message });
      continue;
    }

    if (payload.type === "agent_message" && typeof payload.message === "string") {
      messages.push({ role: "assistant", content: payload.message });
      continue;
    }

    if (entry.type === "response_item" && payload.type === "message") {
      const role = payload.role;
      const content = parseContentBlocks(payload.content);
      if ((role === "user" || role === "assistant") && content) {
        messages.push({ role, content });
      }
    }
  }

  return { sessionPath: resolvedPath, messages: dedupeMessages(messages).slice(-16), rateLimits };
}

function dedupeMessages(messages) {
  const result = [];
  let previousKey = "";

  for (const message of messages) {
    const key = `${message.role}:${message.content}`;
    if (key !== previousKey) {
      result.push(message);
    }
    previousKey = key;
  }

  return result;
}

function formatCodexLimit(limit) {
  if (!limit) return "desconhecido";
  const used = toNumber(limit.used_percent);
  const windowMinutes = toNumber(limit.window_minutes);
  const reset = unixSecondsToLocalTime(limit.resets_at);
  const pieces = [];
  if (used !== null) pieces.push(`${Math.round(used)}% usado`);
  if (windowMinutes !== null) pieces.push(`janela ${windowMinutes} min`);
  if (reset !== "--") pieces.push(`reset ${reset}`);
  return pieces.length ? pieces.join(", ") : "desconhecido";
}

function readRecentTranscript(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== "string" || !fs.existsSync(transcriptPath)) {
    return [];
  }

  const text = fs.readFileSync(transcriptPath, "utf8");
  const lines = text.trim().split(/\r?\n/).slice(-80);
  const messages = [];

  for (const line of lines) {
    const entry = parseJson(line, null);
    if (!entry) continue;
    const role = entry.message?.role ?? entry.role ?? entry.type;
    const rawContent = entry.message?.content ?? entry.content ?? entry.summary;
    const content = normalizeContent(rawContent);
    if (!content) continue;
    if (role === "user" || role === "assistant") {
      messages.push({ role, content });
    }
  }

  return messages.slice(-12);
}

function normalizeContent(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.type === "text" && typeof item.text === "string") return item.text;
      if (item?.type === "tool_use") return `[tool_use: ${item.name ?? "unknown"}]`;
      if (item?.type === "tool_result") return "[tool_result]";
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function truncate(text, max = 1200) {
  const cleaned = String(text ?? "").replace(/\r/g, "").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}\n...` : cleaned;
}

function markdownList(items) {
  if (!items.length) return "- Sem dados suficientes.";
  return items.map((item) => `- ${item}`).join("\n");
}

function buildCodexToClaudeHandoff(input, reason) {
  const cwd = getCwd(input);
  const handoffPath = path.join(cwd, CODEX_HANDOFF_NAME);
  const codex = readCodexSession(input.codex_session_path ?? input.codexSessionPath);
  const gitBranch = runGit(["branch", "--show-current"], cwd);
  const gitStatus = runGit(["status", "--short"], cwd);
  const gitDiffStat = runGit(["diff", "--stat"], cwd);
  const recentMessages = codex.messages;
  const lastUser = [...recentMessages].reverse().find((message) => message.role === "user");
  const lastAssistant = [...recentMessages].reverse().find((message) => message.role === "assistant");
  const primaryLimit = codex.rateLimits?.primary;
  const secondaryLimit = codex.rateLimits?.secondary;

  const content = `# Handoff do Codex para o Claude

Gerado automaticamente em ${new Date().toLocaleString("pt-BR")}.

## Por que o Codex pausou

- Motivo: ${reason}
- Limite primario do Codex: ${formatCodexLimit(primaryLimit)}
- Limite secundario do Codex: ${formatCodexLimit(secondaryLimit)}
- Sessao Codex: ${codex.sessionPath || "nao detectada"}

## Como continuar no Claude

1. Abra este projeto no terminal.
2. Inicie o Claude Code no mesmo diretorio.
3. Envie: "Continue a partir do arquivo ${CODEX_HANDOFF_NAME}. Leia o estado atual do repositorio antes de editar."
4. Peca para o Claude verificar o git diff e rodar os testes/validacoes relevantes antes de finalizar.

## Ultimo pedido do usuario

${lastUser ? truncate(lastUser.content) : "Nao consegui extrair o ultimo pedido do historico do Codex."}

## Ultima resposta do Codex

${lastAssistant ? truncate(lastAssistant.content) : "Nao consegui extrair a ultima resposta do historico do Codex."}

## Estado do repositorio

- Diretorio: ${cwd}
- Branch: ${gitBranch || "nao detectada"}

### Arquivos alterados

\`\`\`text
${gitStatus || "Sem alteracoes detectadas pelo git ou repositorio nao inicializado."}
\`\`\`

### Diff stat

\`\`\`text
${gitDiffStat || "Sem diff stat disponivel."}
\`\`\`

## Conversa recente do Codex

${markdownList(
  recentMessages.map((message) => `${message.role}: ${truncate(message.content, 700).replace(/\n+/g, " ")}`)
)}

## Proximos passos sugeridos para o Claude

- Reconstituir o contexto lendo este arquivo, o git diff e os arquivos modificados.
- Continuar somente a partir do ponto atual, sem refazer alteracoes ja aplicadas.
- Preservar alteracoes existentes do usuario.
- Validar a solucao com comandos do projeto quando existirem.
- Ao finalizar, resumir arquivos alterados, validacoes executadas e riscos restantes.
`;

  fs.writeFileSync(handoffPath, content, "utf8");
  return { handoffPath, codex };
}

function buildHandoff(input, state, reason) {
  const cwd = getCwd(input);
  const handoffPath = path.join(cwd, HANDOFF_NAME);
  const limits = state.limits ?? extractLimits(input);
  const transcriptPath = input.transcript_path ?? input.transcriptPath ?? state.transcriptPath;
  const recentMessages = readRecentTranscript(transcriptPath);
  const gitBranch = runGit(["branch", "--show-current"], cwd);
  const gitStatus = runGit(["status", "--short"], cwd);
  const gitDiffStat = runGit(["diff", "--stat"], cwd);
  const sessionId = input.session_id ?? input.sessionId ?? state.sessionId ?? "desconhecida";
  const resetText = unixSecondsToLocalTime(limits.fiveHour?.resetsAt);

  const lastUser = [...recentMessages].reverse().find((message) => message.role === "user");
  const lastAssistant = [...recentMessages].reverse().find((message) => message.role === "assistant");

  const content = `# Handoff do Claude para o Codex

Gerado automaticamente em ${new Date().toLocaleString("pt-BR")}.

## Por que o Claude pausou

- Motivo: ${reason}
- Uso da janela de 5 horas: ${compactPercent(limits.fiveHour?.usedPercentage) ?? "desconhecido"}%
- Reset estimado da janela de 5 horas: ${resetText}
- Sessao Claude: ${sessionId}

## Como continuar no Codex

1. Abra este projeto no terminal.
2. Inicie o Codex no mesmo diretorio.
3. Envie: "Continue a partir do arquivo ${HANDOFF_NAME}. Leia o estado atual do repositorio antes de editar."
4. Peça para o Codex verificar o git diff e rodar os testes/validacoes relevantes antes de finalizar.

## Ultimo pedido do usuario

${lastUser ? truncate(lastUser.content) : "Nao consegui extrair o ultimo pedido do transcript."}

## Ultima resposta do Claude

${lastAssistant ? truncate(lastAssistant.content) : "Nao consegui extrair a ultima resposta do transcript."}

## Estado do repositorio

- Diretorio: ${cwd}
- Branch: ${gitBranch || "nao detectada"}
- Transcript: ${transcriptPath || "nao detectado"}

### Arquivos alterados

\`\`\`text
${gitStatus || "Sem alteracoes detectadas pelo git ou repositorio nao inicializado."}
\`\`\`

### Diff stat

\`\`\`text
${gitDiffStat || "Sem diff stat disponivel."}
\`\`\`

## Conversa recente

${markdownList(
  recentMessages.map((message) => `${message.role}: ${truncate(message.content, 700).replace(/\n+/g, " ")}`)
)}

## Proximos passos sugeridos

- Reconstituir o contexto lendo este arquivo, o git diff e os arquivos modificados.
- Continuar somente a partir do ponto atual, sem refazer alteracoes ja aplicadas.
- Validar a solucao com comandos do projeto quando existirem.
- Ao finalizar, resumir arquivos alterados, validacoes executadas e riscos restantes.
`;

  fs.writeFileSync(handoffPath, content, "utf8");
  return handoffPath;
}

function codexStatus(input) {
  const codex = readCodexSession(input.codex_session_path ?? input.codexSessionPath);
  const payload = {
    sessionPath: codex.sessionPath,
    primary: codex.rateLimits?.primary ?? null,
    secondary: codex.rateLimits?.secondary ?? null
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function codexCheck(input) {
  const threshold = getThreshold();
  const codex = readCodexSession(input.codex_session_path ?? input.codexSessionPath);
  const used = toNumber(codex.rateLimits?.primary?.used_percent);

  if (used !== null && used >= threshold) {
    const { handoffPath } = buildCodexToClaudeHandoff(
      input,
      `Codex chegou a ${Math.round(used)}% da janela primaria (limite configurado: ${threshold}%).`
    );
    process.stdout.write(`${handoffPath}\n`);
    return;
  }

  process.stdout.write(
    `Codex abaixo do limite: ${used === null ? "uso desconhecido" : `${Math.round(used)}%`} / ${threshold}%.\n`
  );
}

function currentScriptPath() {
  return path.resolve(process.argv[1] || fileURLToPath(import.meta.url));
}

function timestampForBackup() {
  return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

function readClaudeSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  return parseJson(fs.readFileSync(settingsPath, "utf8"), {});
}

function installClaudeIntegration() {
  const threshold = getThreshold();
  const scriptPath = currentScriptPath();
  const nodePath = process.execPath;
  const claudeDir = path.join(os.homedir(), ".claude");
  const settingsPath = path.join(claudeDir, "settings.json");

  fs.mkdirSync(claudeDir, { recursive: true });
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak-limit-handoff-${timestampForBackup()}`);
  }

  const settings = readClaudeSettings(settingsPath);
  settings.hooks ??= {};

  const hookCommand = {
    type: "command",
    command: nodePath,
    args: [scriptPath, "hook", String(threshold)],
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
    command: `${JSON.stringify(nodePath)} ${JSON.stringify(scriptPath)} statusline ${threshold}`,
    refreshInterval: 15,
    padding: 1
  };

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  process.stdout.write(`Installed Claude Limit Handoff in ${settingsPath}\n`);
  process.stdout.write(`Threshold: ${threshold}%\n`);
  process.stdout.write("Restart Claude Code to load the hooks and status line.\n");
}

function uninstallClaudeIntegration() {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  if (!fs.existsSync(settingsPath)) {
    process.stdout.write("settings.json not found.\n");
    return;
  }

  fs.copyFileSync(settingsPath, `${settingsPath}.bak-limit-handoff-uninstall-${timestampForBackup()}`);
  const settings = readClaudeSettings(settingsPath);

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
  process.stdout.write("Removed Claude Limit Handoff. A backup was created next to settings.json.\n");
}

function statusLine(input) {
  const currentLimits = extractLimits(input);
  const cwd = getCwd(input);
  const threshold = getThreshold();
  const existing = loadState();
  const limits = mergeLimits(existing.limits, currentLimits);
  const nextState = {
    ...existing,
    updatedAt: new Date().toISOString(),
    cwd,
    sessionId: input.session_id ?? input.sessionId ?? existing.sessionId,
    transcriptPath: input.transcript_path ?? input.transcriptPath ?? existing.transcriptPath,
    threshold,
    limits
  };
  saveState(nextState);

  const model = input.model?.display_name ?? input.model?.name ?? "Claude";
  const five = compactPercent(limits.fiveHour.usedPercentage);
  const week = compactPercent(limits.sevenDay.usedPercentage);
  const reset = unixSecondsToLocalTime(limits.fiveHour.resetsAt);
  const prefix = five !== null && five >= threshold ? "PAUSAR" : "OK";
  const parts = [`${model}`, `5h ${five ?? "--"}%`];
  if (five !== null) parts.push(`reset ${reset}`);
  if (week !== null) parts.push(`7d ${week}%`);
  parts.push(`${prefix} ${threshold}%`);
  process.stdout.write(parts.join(" | "));
}

function shouldTrigger(state, input) {
  const threshold = getThreshold();
  const limits = mergeLimits(state.limits, extractLimits(input));
  const used = limits.fiveHour?.usedPercentage;
  return Number.isFinite(used) && used >= threshold;
}

function hook(input) {
  const state = loadState();
  const eventName = input.hook_event_name ?? input.hookEventName ?? input.event ?? "unknown";
  const limits = mergeLimits(state.limits, extractLimits(input));
  const effectiveState = { ...state, limits };

  if (JSON.stringify(state.limits) !== JSON.stringify(limits)) {
    saveState({
      ...effectiveState,
      updatedAt: new Date().toISOString()
    });
  }

  if (!shouldTrigger(effectiveState, input)) {
    return;
  }

  const threshold = getThreshold();
  const used = compactPercent(limits.fiveHour?.usedPercentage);
  const reason = `Claude chegou a ${used ?? "mais de"}% da janela de 5 horas (limite configurado: ${threshold}%).`;
  const handoffPath = buildHandoff(input, effectiveState, reason);
  logEvent({ eventName, action: "handoff", handoffPath, used, threshold });

  if (eventName === "PreToolUse") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `${reason} Handoff criado em ${handoffPath}. Pare agora e peça ao usuario para continuar no Codex usando esse arquivo.`
        }
      })
    );
    return;
  }

  if (eventName === "UserPromptSubmit") {
    process.stdout.write(
      JSON.stringify({
        decision: "block",
        reason: `${reason} Handoff criado em ${handoffPath}. Continue no Codex usando esse arquivo.`
      })
    );
    return;
  }

  if (eventName === "StopFailure") {
    process.stderr.write(`${reason} Handoff criado em ${handoffPath}.\n`);
  }
}

function main() {
  const mode = process.argv[2] ?? "statusline";
  const input = parseJson(readStdin(), {});

  try {
    if (mode === "statusline") {
      statusLine(input);
      return;
    }
    if (mode === "install") {
      installClaudeIntegration();
      return;
    }
    if (mode === "uninstall") {
      uninstallClaudeIntegration();
      return;
    }
    if (mode === "hook") {
      hook(input);
      return;
    }
    if (mode === "handoff") {
      const state = loadState();
      const handoffPath = buildHandoff(input, state, "Handoff manual solicitado.");
      process.stdout.write(`${handoffPath}\n`);
      return;
    }
    if (mode === "codex-status") {
      codexStatus(input);
      return;
    }
    if (mode === "codex-check") {
      codexCheck(input);
      return;
    }
    if (["codex-to-claude", "handoff-codex", "codex-handoff", "handoff-to-claude"].includes(mode)) {
      const { handoffPath } = buildCodexToClaudeHandoff(input, "Handoff manual solicitado pelo usuario.");
      process.stdout.write(`${handoffPath}\n`);
      return;
    }
    process.stderr.write(`Modo desconhecido: ${mode}\n`);
    process.exitCode = 1;
  } catch (error) {
    logEvent({ action: "error", mode, message: error?.message ?? String(error) });
    if (mode === "statusline") {
      process.stdout.write("Claude limit handoff indisponivel");
      return;
    }
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  }
}

main();
