# Claude Limit Handoff Plugin

Claude Code plugin that watches the 5-hour Claude usage window and creates a `CLAUDE_TO_CODEX_HANDOFF.md` file when the configured threshold is reached.

Portuguese documentation is available in the repository root and in `docs/pt-br/`.

## Why this plugin exists

Claude Code can hit the 5-hour usage window in the middle of an implementation. This plugin turns that moment into a controlled handoff: it writes project state, recent conversation context, git status, and next steps so the user can continue in Codex.

## Important limitation

Claude Code plugins can ship hooks, skills, agents, MCP servers, and related components, but plugin `settings.json` currently does not support installing a global `statusLine`. The `rate_limits.five_hour.used_percentage` field is available to status line commands, so this plugin requires a one-time setup step after install.

## Local development

From the parent directory:

```powershell
claude --plugin-dir ./claude-limit-handoff-plugin
```

Inside Claude Code, run:

```text
/claude-limit-handoff:setup
```

Then run the printed `node ... install-statusline.mjs` command in a trusted terminal and restart Claude Code.

## Marketplace users

After installing the plugin, run:

```text
/claude-limit-handoff:setup
```

Then restart Claude Code.

## How it works

- The status line records the latest `rate_limits.five_hour.used_percentage`.
- Plugin hooks check that recorded state before user prompts and tool calls.
- When usage reaches the configured threshold, the plugin creates `CLAUDE_TO_CODEX_HANDOFF.md`.
- `PreToolUse` blocks further tool use so Claude stops spending the current window.

## Como funciona

- A status line registra o ultimo `rate_limits.five_hour.used_percentage`.
- Os hooks do plugin consultam esse estado antes de prompts e chamadas de ferramenta.
- Quando o uso chega ao limite configurado, o plugin cria `CLAUDE_TO_CODEX_HANDOFF.md`.
- O `PreToolUse` bloqueia novas ferramentas para o Claude parar de gastar a janela atual.

## Configuration

The plugin exposes a `threshold` option. The default is `90`.
