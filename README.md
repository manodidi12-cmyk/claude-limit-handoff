# Claude Limit Handoff

**English:** Claude Code plugin and local helper that pauses work near usage limits and creates handoff files between Claude Code and Codex.

**Portugues:** Plugin e utilitario local que pausa o trabalho perto de limites de uso e cria arquivos de handoff entre Claude Code e Codex.

---

## English

### The problem

Teams often use both Claude Code and Codex from the VS Code terminal. Claude can reach the 5-hour usage window while it is still implementing a task. When that happens, the user loses momentum and has to reconstruct the context manually in another agent.

Claude Limit Handoff turns that moment into a controlled transition.

### What it does

- Reads Claude Code usage data from the `statusLine` input, especially `rate_limits.five_hour.used_percentage`.
- Stores the latest usage snapshot locally in `~/.claude/limit-handoff/state.json`.
- Watches Claude Code hooks such as `PreToolUse`, `UserPromptSubmit`, and `StopFailure`.
- When the configured threshold is reached, default `90%`, creates `CLAUDE_TO_CODEX_HANDOFF.md` in the current project.
- Blocks new Claude tool calls through `PreToolUse` so Claude does not keep spending the current usage window.
- Writes a practical Claude-to-Codex handoff with recent conversation context, git status, diff summary, reset estimate, and instructions for Codex.
- Can also generate a manual Codex-to-Claude handoff from local Codex session history.

### Repository layout

```text
.
├── .claude-plugin/marketplace.json
├── claude-limit-handoff-plugin/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── scripts/
│   └── skills/setup/SKILL.md
├── docs/
│   ├── en/
│   └── pt-br/
├── src/claude-limit-handoff.mjs
├── scripts/install.mjs
├── codex-to-claude.ps1
├── claude-to-codex.ps1
├── install.ps1
├── uninstall.ps1
└── test/guard.test.mjs
```

### Install as a Claude Code plugin

After this repository is published on GitHub, add it as a Claude Code marketplace:

```text
/plugin marketplace add manodidi12-cmyk/claude-limit-handoff
/plugin install claude-limit-handoff@claude-limit-tools
```

Then run the setup skill:

```text
/claude-limit-handoff:setup
```

The setup skill prints a trusted terminal command that installs the required `statusLine`. Restart Claude Code after running it.

### Why the extra setup step exists

Claude Code plugins can ship hooks and skills, but plugin manifests currently cannot install a global `statusLine` setting by themselves. The usage percentage is exposed to status line commands, so this project uses:

1. Plugin hooks to decide when to pause Claude.
2. A one-time setup command to add the status line reader to `~/.claude/settings.json`.

### Install as a local helper

If you do not want to use the plugin marketplace flow:

```powershell
.\install.ps1 -Threshold 90
```

Restart Claude Code after installation.

To remove:

```powershell
.\uninstall.ps1
```

### How the handoff works

When the 5-hour usage reaches the configured threshold, the generated file includes:

- why Claude paused;
- current 5-hour usage percentage;
- estimated reset time;
- Claude session id when available;
- last user request extracted from the transcript;
- last Claude response extracted from the transcript;
- current project directory;
- git branch, status, and diff stat;
- recent conversation summary;
- exact next steps for Codex.

In Codex, start from the same project directory and send:

```text
Continue from CLAUDE_TO_CODEX_HANDOFF.md. Read the current repository state before editing.
```

### Manual Codex to Claude handoff

The reverse direction is available as a manual command:

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

The helper reads the latest local Codex session from `~/.codex/sessions` when available, including the most recent Codex `rate_limits` snapshot. Codex does not currently expose a Claude-style plugin hook/status-line integration in this project, so this direction is intentionally manual.

In Claude Code, start from the same project directory and send:

```text
Continue from CODEX_TO_CLAUDE_HANDOFF.md. Read the current repository state before editing.
```

To inspect the latest Codex usage snapshot:

```powershell
node .\src\claude-limit-handoff.mjs codex-status
```

To generate the reverse handoff only when Codex is already at or above the configured threshold:

```powershell
node .\src\claude-limit-handoff.mjs codex-check 90
```

### Development

```powershell
npm test
claude plugin validate ./claude-limit-handoff-plugin --strict
claude plugin validate . --strict
```

See the detailed English docs in [docs/en/overview.md](docs/en/overview.md).

---

## Portugues

### O problema

Muitas equipes usam Claude Code e Codex no terminal do VS Code. O Claude pode bater o limite da janela de 5 horas no meio de uma implementacao. Quando isso acontece, voce perde o embalo e precisa reconstruir o contexto manualmente em outro agente.

O Claude Limit Handoff transforma esse momento em uma transicao organizada.

### O que ele faz

- Le os dados de uso do Claude Code pelo input da `statusLine`, principalmente `rate_limits.five_hour.used_percentage`.
- Salva o ultimo snapshot de uso em `~/.claude/limit-handoff/state.json`.
- Observa hooks do Claude Code como `PreToolUse`, `UserPromptSubmit` e `StopFailure`.
- Quando o limite configurado e atingido, por padrao `90%`, cria `CLAUDE_TO_CODEX_HANDOFF.md` no projeto atual.
- Bloqueia novas chamadas de ferramenta do Claude pelo `PreToolUse` para evitar gastar ainda mais a janela atual.
- Escreve um handoff Claude-para-Codex com contexto recente, status do git, resumo do diff, estimativa de reset e instrucoes para o Codex.
- Tambem gera um handoff manual Codex-para-Claude usando o historico local de sessoes do Codex.

### Instalar como plugin do Claude Code

Depois que este repositorio estiver publicado no GitHub, adicione-o como marketplace do Claude Code:

```text
/plugin marketplace add manodidi12-cmyk/claude-limit-handoff
/plugin install claude-limit-handoff@claude-limit-tools
```

Depois rode a skill de setup:

```text
/claude-limit-handoff:setup
```

A skill mostra um comando confiavel para instalar a `statusLine` necessaria. Reinicie o Claude Code depois de executar o comando.

### Por que existe esse passo extra

Plugins do Claude Code conseguem carregar hooks e skills, mas atualmente nao conseguem instalar uma configuracao global de `statusLine` sozinhos. Como o percentual de uso aparece para comandos de status line, este projeto usa:

1. Hooks do plugin para decidir quando pausar o Claude.
2. Um comando de setup unico para adicionar o leitor de status line ao `~/.claude/settings.json`.

### Instalar como utilitario local

Se voce nao quiser usar o fluxo de marketplace/plugin:

```powershell
.\install.ps1 -Threshold 90
```

Reinicie o Claude Code depois da instalacao.

Para remover:

```powershell
.\uninstall.ps1
```

### Como o handoff funciona

Quando a janela de 5 horas chega ao limite configurado, o arquivo gerado inclui:

- por que o Claude pausou;
- percentual atual da janela de 5 horas;
- horario estimado de reset;
- id da sessao Claude quando disponivel;
- ultimo pedido do usuario extraido do transcript;
- ultima resposta do Claude extraida do transcript;
- diretorio atual do projeto;
- branch, status e diff stat do git;
- resumo da conversa recente;
- proximos passos para o Codex.

No Codex, abra o mesmo diretorio do projeto e envie:

```text
Continue a partir do arquivo CLAUDE_TO_CODEX_HANDOFF.md. Leia o estado atual do repositorio antes de editar.
```

### Handoff manual do Codex para o Claude

O fluxo inverso existe como comando manual:

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

O utilitario le a sessao local mais recente do Codex em `~/.codex/sessions` quando disponivel, incluindo o ultimo snapshot de `rate_limits` do Codex. O Codex ainda nao expoe, neste projeto, uma integracao de hook/status line igual a do Claude, entao esse sentido e manual de proposito.

No Claude Code, abra o mesmo diretorio do projeto e envie:

```text
Continue a partir do arquivo CODEX_TO_CLAUDE_HANDOFF.md. Leia o estado atual do repositorio antes de editar.
```

Para inspecionar o ultimo snapshot de uso do Codex:

```powershell
node .\src\claude-limit-handoff.mjs codex-status
```

Para gerar o handoff inverso somente quando o Codex ja estiver no limite configurado:

```powershell
node .\src\claude-limit-handoff.mjs codex-check 90
```

### Desenvolvimento

```powershell
npm test
claude plugin validate ./claude-limit-handoff-plugin --strict
claude plugin validate . --strict
```

Veja a documentacao detalhada em portugues em [docs/pt-br/visao-geral.md](docs/pt-br/visao-geral.md).
