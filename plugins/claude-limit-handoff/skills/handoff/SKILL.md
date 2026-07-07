---
name: handoff
description: Generate handoff files between Codex and Claude Code using the local Claude Limit Handoff helper.
---

# Claude Limit Handoff

Use this skill when the user asks Codex to hand work to Claude Code, check Codex usage before handing off, or generate a Claude/Codex continuation file.

## Available Commands

Run these from the current project directory.

### Codex to Claude Code

Generate `CODEX_TO_CLAUDE_HANDOFF.md`:

```powershell
node "C:\Users\Diego\Documents\leitor de limite\src\claude-limit-handoff.mjs" codex-to-claude
```

Then tell the user to open Claude Code in the same project and send:

```text
Continue a partir do arquivo CODEX_TO_CLAUDE_HANDOFF.md. Leia o estado atual do repositorio antes de editar.
```

### Codex usage check

Show the latest Codex usage snapshot:

```powershell
node "C:\Users\Diego\Documents\leitor de limite\src\claude-limit-handoff.mjs" codex-status
```

Generate `CODEX_TO_CLAUDE_HANDOFF.md` only if Codex is at or above the threshold:

```powershell
node "C:\Users\Diego\Documents\leitor de limite\src\claude-limit-handoff.mjs" codex-check 90
```

### Claude Code to Codex

Generate `CLAUDE_TO_CODEX_HANDOFF.md` manually:

```powershell
node "C:\Users\Diego\Documents\leitor de limite\src\claude-limit-handoff.mjs" handoff
```

## Behavior

- The Codex-to-Claude handoff reads the latest local Codex session history from `~/.codex/sessions`.
- It includes the latest Codex `rate_limits` snapshot when available.
- It writes the file in the current project directory.
- It preserves the user's working tree and does not modify source files except for the generated handoff file.

## Important

Codex does not currently have the same automatic `PreToolUse` pause integration used by Claude Code in this repository. This skill provides a global Codex command path for manual or threshold-checked handoff.
