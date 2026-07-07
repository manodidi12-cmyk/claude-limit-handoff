---
description: Configure the Claude Limit Handoff status line after installing the plugin.
disable-model-invocation: true
---

Run this command from a trusted terminal to enable the status line that reads Claude Code rate-limit data:

```powershell
node "${CLAUDE_PLUGIN_ROOT}/scripts/install-statusline.mjs"
```

Then restart Claude Code. The plugin hooks are loaded by the plugin, but this one-time setup is required because Claude Code plugins cannot currently ship a global `statusLine` setting.
