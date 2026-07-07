# Claude Limit Handoff

## Index

- [English](#english)
  - [Get Started](#get-started)
  - [Use It](#use-it)
  - [Install Options](#install-options)
  - [How It Works](#how-it-works)
  - [Detailed English Guide](docs/en/overview.md)
- [Portugues](#portugues)
  - [Comece Agora](#comece-agora)
  - [Como Usar](#como-usar)
  - [Instalacao](#instalacao)
  - [Guia Detalhado em Portugues](docs/pt-br/visao-geral.md)

---

## English

Claude Limit Handoff keeps work moving when Claude Code or Codex gets close to a usage limit. It creates a handoff file with the current repo state, recent conversation context, rate-limit information when available, and exact instructions for continuing in the other assistant.

```text
Claude Code near limit -> CLAUDE_TO_CODEX_HANDOFF.md -> continue in Codex
Codex near limit      -> CODEX_TO_CLAUDE_HANDOFF.md -> continue in Claude Code
```

## Get Started

Clone and install:

```powershell
git clone https://github.com/manodidi12-cmyk/claude-limit-handoff.git
cd claude-limit-handoff
node .\src\claude-limit-handoff.mjs install 90
```

Restart Claude Code after installation.

That is it. Claude Code will show usage in the status line and pause tool use at `90%` of the 5-hour window.

## Use It

### Claude Code to Codex

When Claude Code reaches the configured threshold, the hook creates:

```text
CLAUDE_TO_CODEX_HANDOFF.md
```

Then open Codex in the same project and send:

```text
Continue from CLAUDE_TO_CODEX_HANDOFF.md. Read the current repository state before editing.
```

You can also create this handoff manually:

```powershell
.\claude-to-codex.ps1
```

### Codex to Claude Code

Create the reverse handoff manually:

```powershell
.\codex-to-claude.ps1
```

or:

```powershell
node .\src\claude-limit-handoff.mjs codex-to-claude
```

This creates:

```text
CODEX_TO_CLAUDE_HANDOFF.md
```

Then open Claude Code in the same project and send:

```text
Continue from CODEX_TO_CLAUDE_HANDOFF.md. Read the current repository state before editing.
```

Check the latest Codex usage snapshot:

```powershell
node .\src\claude-limit-handoff.mjs codex-status
```

Generate the Codex-to-Claude handoff only if Codex is already at or above the threshold:

```powershell
node .\src\claude-limit-handoff.mjs codex-check 90
```

## Install Options

### Recommended: CLI install

```powershell
node .\src\claude-limit-handoff.mjs install 90
```

The install command:

- backs up `~/.claude/settings.json`;
- adds Claude Code hooks;
- adds the required Claude Code `statusLine`;
- stores state in `~/.claude/limit-handoff/`;
- uses the threshold you pass, defaulting to `90`.

Uninstall:

```powershell
node .\src\claude-limit-handoff.mjs uninstall
```

PowerShell wrappers are also included:

```powershell
.\install.ps1 -Threshold 90
.\uninstall.ps1
```

### Optional: install as a Claude Code plugin

This repository also ships a Claude Code plugin/marketplace manifest:

```text
/plugin marketplace add manodidi12-cmyk/claude-limit-handoff
/plugin install claude-limit-handoff@claude-limit-tools
/claude-limit-handoff:setup
```

The plugin flow is useful if you specifically want to manage it through Claude Code's plugin system.

Important: Claude Code plugins can ship hooks and skills, but they cannot currently install a global `statusLine` by themselves. That is why the plugin has a small setup skill. The CLI install above does everything in one command.

## What Gets Written

`CLAUDE_TO_CODEX_HANDOFF.md` includes:

- why Claude paused;
- 5-hour usage percentage and reset time;
- Claude session id when available;
- last user request and Claude response;
- current directory, branch, git status, and diff stat;
- recent conversation context;
- next steps for Codex.

`CODEX_TO_CLAUDE_HANDOFF.md` includes:

- latest local Codex session path;
- latest Codex primary and secondary `rate_limits` snapshot when present;
- last user request and Codex response;
- current directory, branch, git status, and diff stat;
- recent Codex conversation context;
- next steps for Claude Code.

## How It Works

Claude Code exposes `rate_limits.five_hour.used_percentage` to status line commands. Claude Limit Handoff uses that status line to keep a local usage snapshot. Hooks then read that snapshot before prompts and tool calls. If the configured threshold has been reached, the hook writes the handoff and blocks further Claude tool use.

Codex stores rate-limit snapshots in local session logs. Claude Limit Handoff can read those logs for `codex-status`, `codex-check`, and manual Codex-to-Claude handoffs. The reverse direction is manual because this project does not depend on a Codex hook that can block work like Claude Code's `PreToolUse`.

## Repository Layout

```text
.
|-- .claude-plugin/marketplace.json
|-- claude-limit-handoff-plugin/
|   |-- .claude-plugin/plugin.json
|   |-- hooks/hooks.json
|   |-- scripts/
|   `-- skills/setup/SKILL.md
|-- docs/
|   |-- en/
|   `-- pt-br/
|-- src/claude-limit-handoff.mjs
|-- codex-to-claude.ps1
|-- claude-to-codex.ps1
|-- install.ps1
|-- uninstall.ps1
`-- test/guard.test.mjs
```

## Development

```powershell
npm test
claude plugin validate ./claude-limit-handoff-plugin --strict
claude plugin validate . --strict
```

Detailed docs:

- [English guide](docs/en/overview.md)
- [Guia em portugues](docs/pt-br/visao-geral.md)

---

## Portugues

O Claude Limit Handoff mantem o trabalho andando quando o Claude Code ou o Codex chega perto do limite de uso. Ele cria um arquivo de handoff com estado atual do repositorio, contexto recente da conversa, informacoes de limite quando disponiveis e instrucoes para continuar no outro assistente.

```text
Claude Code perto do limite -> CLAUDE_TO_CODEX_HANDOFF.md -> continuar no Codex
Codex perto do limite       -> CODEX_TO_CLAUDE_HANDOFF.md -> continuar no Claude Code
```

## Comece Agora

Clone e instale:

```powershell
git clone https://github.com/manodidi12-cmyk/claude-limit-handoff.git
cd claude-limit-handoff
node .\src\claude-limit-handoff.mjs install 90
```

Reinicie o Claude Code depois da instalacao.

Pronto. O Claude Code passa a mostrar o uso na status line e pausa ferramentas quando chegar em `90%` da janela de 5 horas.

## Como Usar

### Claude Code para Codex

Quando o Claude Code chega ao limite configurado, o hook cria:

```text
CLAUDE_TO_CODEX_HANDOFF.md
```

Abra o Codex no mesmo projeto e envie:

```text
Continue a partir do arquivo CLAUDE_TO_CODEX_HANDOFF.md. Leia o estado atual do repositorio antes de editar.
```

Tambem da para criar esse handoff manualmente:

```powershell
.\claude-to-codex.ps1
```

### Codex para Claude Code

Crie o handoff inverso manualmente:

```powershell
.\codex-to-claude.ps1
```

ou:

```powershell
node .\src\claude-limit-handoff.mjs codex-to-claude
```

Isso cria:

```text
CODEX_TO_CLAUDE_HANDOFF.md
```

Abra o Claude Code no mesmo projeto e envie:

```text
Continue a partir do arquivo CODEX_TO_CLAUDE_HANDOFF.md. Leia o estado atual do repositorio antes de editar.
```

Ver o ultimo uso detectado do Codex:

```powershell
node .\src\claude-limit-handoff.mjs codex-status
```

Gerar o handoff Codex-para-Claude somente se o Codex ja estiver no limite:

```powershell
node .\src\claude-limit-handoff.mjs codex-check 90
```

## Instalacao

### Recomendado: instalacao pelo CLI

```powershell
node .\src\claude-limit-handoff.mjs install 90
```

Esse comando:

- cria backup de `~/.claude/settings.json`;
- adiciona hooks do Claude Code;
- adiciona a `statusLine` necessaria;
- salva estado em `~/.claude/limit-handoff/`;
- usa o limite informado, por padrao `90`.

Remover:

```powershell
node .\src\claude-limit-handoff.mjs uninstall
```

Tambem existem atalhos PowerShell:

```powershell
.\install.ps1 -Threshold 90
.\uninstall.ps1
```

### Opcional: plugin do Claude Code

O repositorio tambem inclui manifest de plugin/marketplace do Claude Code:

```text
/plugin marketplace add manodidi12-cmyk/claude-limit-handoff
/plugin install claude-limit-handoff@claude-limit-tools
/claude-limit-handoff:setup
```

Use esse caminho se voce quiser gerenciar pelo sistema de plugins do Claude Code.

Importante: plugins do Claude Code conseguem instalar hooks e skills, mas ainda nao conseguem instalar uma `statusLine` global sozinhos. Por isso o plugin tem uma skill pequena de setup. A instalacao pelo CLI acima faz tudo em um comando.
