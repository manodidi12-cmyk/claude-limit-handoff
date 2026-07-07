# Claude Limit Handoff

## Index

- [English](#english)
  - [Get Started](#get-started)
  - [Use It](#use-it)
  - [Install Options](#install-options)
  - [Codex Plugin](#codex-plugin)
  - [How It Works](#how-it-works)
  - [Detailed English Guide](docs/en/overview.md)
- [Portugues](#portugues)
  - [Comece Agora](#comece-agora)
  - [Como Usar](#como-usar)
  - [Instalacao](#instalacao)
  - [Plugin do Codex](#plugin-do-codex)
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

After installing the Codex plugin, you can also ask Codex:

```text
Use the Claude Limit Handoff skill to create a Codex to Claude handoff.
```

## Install Options

There are two Claude Code install paths. Most users should use the CLI/PowerShell path.

| Method | Best for | What it installs | Extra setup? |
| --- | --- | --- | --- |
| CLI / PowerShell | Normal use on your own machine | Claude hooks + `statusLine` in one command | No |
| Claude Code plugin | Users who want to manage it through Claude's plugin system | Plugin hooks + setup skill | Yes, run `/claude-limit-handoff:setup` |

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

Use this on every computer where you want Claude Code handoff protection. The setup is local to that machine, even when you use the same Claude account.

Uninstall:

```powershell
node .\src\claude-limit-handoff.mjs uninstall
```

PowerShell shortcuts are included for convenience:

```powershell
.\install.ps1 -Threshold 90
.\uninstall.ps1
```

These shortcuts do the same thing as the direct `node ... install` and `node ... uninstall` commands. They are useful on Windows because they are shorter and easier to remember.

### Optional: install as a Claude Code plugin

This repository also ships a Claude Code plugin/marketplace manifest:

```text
/plugin marketplace add manodidi12-cmyk/claude-limit-handoff
/plugin install claude-limit-handoff@claude-limit-tools
/claude-limit-handoff:setup
```

The plugin flow is useful if you specifically want to manage it through Claude Code's plugin system.

Important: Claude Code plugins can ship hooks and skills, but they cannot currently install a global `statusLine` by themselves. That is why the plugin has a small setup skill. The CLI/PowerShell install above does everything in one command.

In practical terms:

- CLI/PowerShell install is simpler and recommended.
- Claude Code plugin install is more "plugin-native", but needs the extra setup step.
- Both paths write local configuration on the current computer.
- Neither path syncs automatically to another computer through your Claude account.

### Optional: install as a Codex plugin

This repository also includes a Codex plugin marketplace:

```powershell
codex plugin marketplace add .
codex plugin add claude-limit-handoff@claude-limit-tools
```

Start a new Codex thread after installing so the skill is loaded.

## Codex Plugin

The Codex plugin is installed from this repository marketplace:

```text
claude-limit-handoff@claude-limit-tools
```

It adds a Codex skill named `handoff`. Use it when you want Codex to create or check a handoff for Claude Code.

Example prompt in a new Codex thread:

```text
Use the handoff skill to create a Codex to Claude handoff for this project.
```

Current limitation: Codex does not expose the same automatic `PreToolUse` pause hook used by Claude Code here. The Codex plugin gives you a global skill/command path, while the Claude side remains automatic.

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
|-- .agents/plugins/marketplace.json
|-- claude-limit-handoff-plugin/
|   |-- .claude-plugin/plugin.json
|   |-- hooks/hooks.json
|   |-- scripts/
|   `-- skills/setup/SKILL.md
|-- plugins/claude-limit-handoff/
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

Depois de instalar o plugin do Codex, voce tambem pode pedir ao Codex:

```text
Use a skill Claude Limit Handoff para criar um handoff do Codex para o Claude.
```

## Instalacao

Existem dois caminhos para instalar no Claude Code. Para uso normal, use o caminho CLI/PowerShell.

| Metodo | Melhor para | O que instala | Setup extra? |
| --- | --- | --- | --- |
| CLI / PowerShell | Uso normal na sua maquina | Hooks do Claude + `statusLine` em um comando | Nao |
| Plugin do Claude Code | Quem quer gerenciar pelo sistema de plugins do Claude | Hooks do plugin + skill de setup | Sim, rodar `/claude-limit-handoff:setup` |

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

Use esse comando em cada computador onde voce quer proteger o Claude Code. A configuracao e local da maquina, mesmo usando a mesma conta Claude.

Remover:

```powershell
node .\src\claude-limit-handoff.mjs uninstall
```

Tambem existem atalhos PowerShell:

```powershell
.\install.ps1 -Threshold 90
.\uninstall.ps1
```

Esses atalhos fazem a mesma coisa que `node ... install` e `node ... uninstall`. Eles existem para facilitar no Windows, porque sao mais curtos e mais faceis de lembrar.

### Opcional: plugin do Claude Code

O repositorio tambem inclui manifest de plugin/marketplace do Claude Code:

```text
/plugin marketplace add manodidi12-cmyk/claude-limit-handoff
/plugin install claude-limit-handoff@claude-limit-tools
/claude-limit-handoff:setup
```

Use esse caminho se voce quiser gerenciar pelo sistema de plugins do Claude Code.

Importante: plugins do Claude Code conseguem instalar hooks e skills, mas ainda nao conseguem instalar uma `statusLine` global sozinhos. Por isso o plugin tem uma skill pequena de setup. A instalacao por CLI/PowerShell acima faz tudo em um comando.

Na pratica:

- CLI/PowerShell e mais simples e recomendado.
- Plugin do Claude Code e mais "nativo de plugin", mas precisa do setup extra.
- Os dois caminhos escrevem configuracao local neste computador.
- Nenhum dos dois sincroniza automaticamente para outro computador pela sua conta Claude.

### Opcional: plugin do Codex

O repositorio tambem inclui um marketplace de plugin do Codex:

```powershell
codex plugin marketplace add .
codex plugin add claude-limit-handoff@claude-limit-tools
```

Abra uma nova conversa no Codex depois de instalar para a skill ser carregada.

## Plugin do Codex

O plugin do Codex e instalado a partir deste marketplace do repositorio:

```text
claude-limit-handoff@claude-limit-tools
```

Ele adiciona uma skill do Codex chamada `handoff`. Use quando quiser que o Codex crie ou cheque um handoff para o Claude Code.

Exemplo de prompt em uma nova conversa do Codex:

```text
Use a skill handoff para criar um handoff do Codex para o Claude neste projeto.
```

Limitacao atual: o Codex nao expoe o mesmo hook automatico `PreToolUse` que usamos no Claude Code. O plugin do Codex te da uma skill/caminho global de comando, enquanto o lado do Claude continua automatico.
