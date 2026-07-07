# Claude Limit Handoff: English Guide

## Goal

Claude Limit Handoff helps users who work with both Claude Code and Codex. When Claude Code approaches the 5-hour usage window limit, the plugin pauses new tool use and writes a handoff document so Codex can continue from the same project state. It can also create a manual Codex-to-Claude handoff from the local Codex session history.

## Full flow

1. Claude Code starts with the plugin installed.
2. The user runs the setup skill once to install the status line reader.
3. The status line receives Claude Code usage metadata after Claude responses.
4. The helper stores the latest 5-hour usage percentage in `~/.claude/limit-handoff/state.json`.
5. Plugin hooks run before prompts and tool calls.
6. If usage is below the threshold, nothing happens.
7. If usage is at or above the threshold, the helper writes `CLAUDE_TO_CODEX_HANDOFF.md`.
8. On `PreToolUse`, the hook denies the tool call and tells Claude to stop.
9. The user opens Codex in the same directory and asks it to continue from the handoff file.

## Reverse flow: Codex to Claude

The reverse flow is manual:

```powershell
.\codex-to-claude.ps1
```

or:

```powershell
node .\src\claude-limit-handoff.mjs codex-to-claude
```

It creates `CODEX_TO_CLAUDE_HANDOFF.md` in the current project. The file includes:

- latest local Codex session path;
- latest Codex primary and secondary rate-limit snapshots when present;
- last user request from the Codex session;
- last Codex response;
- git branch, status, and diff stat;
- suggested Claude Code continuation steps.

Codex session logs can contain rate-limit metadata, but this project does not rely on a Codex hook that can block work the same way Claude Code `PreToolUse` can. That is why this direction is a deliberate command instead of an automatic pause.

To make a threshold-aware one-shot check:

```powershell
node .\src\claude-limit-handoff.mjs codex-check 90
```

If the latest Codex primary usage is at or above `90`, it creates `CODEX_TO_CLAUDE_HANDOFF.md`; otherwise it prints the current usage and exits without writing the file.

## Codex plugin

This repository includes a Codex plugin at `plugins/claude-limit-handoff` and a repo-local marketplace at `.agents/plugins/marketplace.json`.

Install it with:

```powershell
codex plugin marketplace add .
codex plugin add claude-limit-handoff@claude-limit-tools
```

Start a new Codex thread after installing. The plugin provides a `handoff` skill that explains and runs the handoff commands from any project.

## Components

### Status line reader

The status line command runs:

```text
node claude-limit-handoff.mjs statusline 90
```

Claude Code passes JSON on stdin. The helper reads `rate_limits.five_hour.used_percentage`, keeps the latest usable value, and prints a compact status line such as:

```text
Opus | 5h 87% | reset 14:30 | OK 90%
```

When the threshold is reached, the output changes to:

```text
Opus | 5h 91% | reset 14:30 | PAUSAR 90%
```

### Hooks

The plugin ships hooks for:

- `PreToolUse`: blocks new Claude tool calls when the threshold has been reached.
- `UserPromptSubmit`: warns before more work is submitted after the threshold.
- `StopFailure`: creates a handoff if Claude stops because of a rate-limit event.

### Handoff file

The generated `CLAUDE_TO_CODEX_HANDOFF.md` is designed for another coding agent. It includes enough context to continue without asking the user to reconstruct the task manually.

## Configuration

The default threshold is `90`. In the plugin manifest this is exposed as `threshold`.

For the local helper installer:

```powershell
.\install.ps1 -Threshold 85
```

## Known limitations

- Claude Code does not expose a way for this script to interrupt a single long model response while it is already streaming.
- The helper can only act at hook/status line boundaries.
- The plugin needs one manual setup step because plugin manifests cannot currently install global `statusLine` settings.

## Recommended Codex prompt

```text
Continue from CLAUDE_TO_CODEX_HANDOFF.md. Read the current repository state before editing. Preserve existing user changes, inspect the git diff, and run the relevant validations before finalizing.
```

## Recommended Claude prompt

```text
Continue from CODEX_TO_CLAUDE_HANDOFF.md. Read the current repository state before editing. Preserve existing user changes, inspect the git diff, and run the relevant validations before finalizing.
```
