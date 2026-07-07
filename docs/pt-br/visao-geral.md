# Claude Limit Handoff: Guia em Portugues

## Objetivo

O Claude Limit Handoff ajuda quem trabalha com Claude Code e Codex. Quando o Claude Code chega perto do limite da janela de 5 horas, o plugin pausa novas chamadas de ferramenta e escreve um documento de handoff para o Codex continuar do mesmo estado do projeto. Ele tambem consegue criar um handoff manual do Codex para o Claude usando o historico local de sessoes do Codex.

## Fluxo completo

1. O Claude Code inicia com o plugin instalado.
2. O usuario roda a skill de setup uma vez para instalar o leitor da status line.
3. A status line recebe metadados de uso depois das respostas do Claude.
4. O utilitario salva o percentual mais recente da janela de 5 horas em `~/.claude/limit-handoff/state.json`.
5. Os hooks do plugin rodam antes de prompts e chamadas de ferramenta.
6. Se o uso estiver abaixo do limite, nada acontece.
7. Se o uso estiver no limite ou acima dele, o utilitario cria `CLAUDE_TO_CODEX_HANDOFF.md`.
8. No `PreToolUse`, o hook nega a chamada de ferramenta e orienta o Claude a parar.
9. O usuario abre o Codex no mesmo diretorio e pede para continuar pelo arquivo de handoff.

## Fluxo inverso: Codex para Claude

O fluxo inverso e manual:

```powershell
.\codex-to-claude.ps1
```

ou:

```powershell
node .\src\claude-limit-handoff.mjs codex-to-claude
```

Ele cria `CODEX_TO_CLAUDE_HANDOFF.md` no projeto atual. O arquivo inclui:

- caminho da sessao local mais recente do Codex;
- ultimo snapshot de limite primario e secundario do Codex, quando existir;
- ultimo pedido do usuario na sessao do Codex;
- ultima resposta do Codex;
- branch, status e diff stat do git;
- passos sugeridos para continuar no Claude Code.

Os logs de sessao do Codex podem conter metadados de limite, mas este projeto nao depende de um hook do Codex capaz de bloquear trabalho como o `PreToolUse` do Claude Code. Por isso esse sentido e um comando manual, nao uma pausa automatica.

Para fazer uma checagem unica baseada no limite:

```powershell
node .\src\claude-limit-handoff.mjs codex-check 90
```

Se o ultimo uso primario do Codex estiver em `90` ou acima, ele cria `CODEX_TO_CLAUDE_HANDOFF.md`; caso contrario, mostra o uso atual e nao escreve o arquivo.

## Plugin do Codex

Este repositorio inclui um plugin do Codex em `plugins/claude-limit-handoff` e um marketplace local em `.agents/plugins/marketplace.json`.

Instale com:

```powershell
codex plugin marketplace add .
codex plugin add claude-limit-handoff@claude-limit-tools
```

Abra uma nova conversa no Codex depois de instalar. O plugin fornece uma skill `handoff` que explica e executa os comandos de handoff a partir de qualquer projeto.

## Componentes

### Leitor da status line

O comando da status line executa:

```text
node claude-limit-handoff.mjs statusline 90
```

O Claude Code envia JSON pelo stdin. O utilitario le `rate_limits.five_hour.used_percentage`, guarda o ultimo valor valido e imprime uma linha compacta como:

```text
Opus | 5h 87% | reset 14:30 | OK 90%
```

Quando o limite e atingido, a saida muda para:

```text
Opus | 5h 91% | reset 14:30 | PAUSAR 90%
```

### Hooks

O plugin inclui hooks para:

- `PreToolUse`: bloqueia novas chamadas de ferramenta do Claude quando o limite foi atingido.
- `UserPromptSubmit`: avisa antes de continuar mandando trabalho depois do limite.
- `StopFailure`: cria um handoff se o Claude parar por evento de rate limit.

### Arquivo de handoff

O `CLAUDE_TO_CODEX_HANDOFF.md` foi pensado para outro agente de codigo. Ele contem contexto suficiente para continuar sem obrigar o usuario a reconstruir a tarefa manualmente.

## Configuracao

O limite padrao e `90`. No manifesto do plugin isso aparece como `threshold`.

Para o instalador local:

```powershell
.\install.ps1 -Threshold 85
```

## Caminhos de instalacao

Para uso normal, use a instalacao por CLI/PowerShell:

```powershell
node .\src\claude-limit-handoff.mjs install 90
```

ou:

```powershell
.\install.ps1 -Threshold 90
```

Isso grava os hooks do Claude Code e a `statusLine` necessaria no `~/.claude/settings.json` local.

O caminho via plugin do Claude Code tambem existe:

```text
/plugin marketplace add manodidi12-cmyk/claude-limit-handoff
/plugin install claude-limit-handoff@claude-limit-tools
/claude-limit-handoff:setup
```

Esse caminho precisa de `/claude-limit-handoff:setup` porque plugins do Claude Code ainda nao conseguem instalar uma `statusLine` global sozinhos.

## Limitacoes conhecidas

- O Claude Code nao expoe uma forma deste script interromper uma resposta longa enquanto ela ja esta sendo gerada.
- O utilitario so consegue agir nos pontos de hook/status line.
- O plugin precisa de um setup manual porque manifestos de plugin ainda nao conseguem instalar `statusLine` global.

## Prompt recomendado para o Codex

```text
Continue a partir do arquivo CLAUDE_TO_CODEX_HANDOFF.md. Leia o estado atual do repositorio antes de editar. Preserve alteracoes existentes do usuario, inspecione o git diff e rode as validacoes relevantes antes de finalizar.
```

## Prompt recomendado para o Claude

```text
Continue a partir do arquivo CODEX_TO_CLAUDE_HANDOFF.md. Leia o estado atual do repositorio antes de editar. Preserve alteracoes existentes do usuario, inspecione o git diff e rode as validacoes relevantes antes de finalizar.
```
