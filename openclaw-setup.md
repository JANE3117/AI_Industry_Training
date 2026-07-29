# OpenClaw (Crestodian) — linking to Claude Code

Notes from getting the local OpenClaw agent ("Crestodian") to run inference
through a real Claude Code login instead of a raw Anthropic API key. Unrelated
to the furniture-app project — kept as a separate file rather than folded
into [requirements.md](requirements.md).

## Starting problem

Crestodian's default model was `anthropic/claude-opus-4-8`, but OpenClaw had
no Anthropic API key and wasn't detecting any CLI login (Claude Code, Codex,
or Gemini CLI), so inference couldn't run.

## Diagnosis

- `~/.claude/.credentials.json` already existed and was populated — Claude
  Code *was* logged in on this machine (the session doing this diagnosis was
  itself running as a Claude Code session, via the VS Code extension).
- `~/.openclaw/openclaw.json` routes Anthropic models through
  `agentRuntime: { id: "claude-cli" }` — OpenClaw expects to shell out to a
  `claude` binary on PATH, not read the credential file directly.
- `claude --version` → `command not found`. The only `claude` binary on disk
  was inside the VS Code extension's private folder
  (`~/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude`),
  not on PATH and not meant to be invoked standalone.
- Separately, `which npm` / `which node` resolved to the **Windows-side**
  install (`/mnt/c/Program Files/nodejs/`) rather than the WSL one, even
  though Node v24.18.0 was already installed via nvm at
  `~/.nvm/versions/node/v24.18.0`. It just wasn't active in the shell used
  for the install.

## Fix

Installed the real Claude Code CLI package globally using the WSL/nvm
Node (not the Windows npm on PATH):

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
nvm use v24.18.0
npm install -g @anthropic-ai/claude-code
```

Verified:

```bash
which claude   # -> ~/.nvm/versions/node/v24.18.0/bin/claude
claude --version   # -> 2.1.220 (Claude Code)
```

Because it shares the same credential store (`~/.claude/.credentials.json`),
the newly-installed CLI should already be authenticated — no separate login
step should be needed.

## Follow-up / not yet confirmed

- Did not confirm interactively that `claude` (run standalone, no args)
  actually opens an authenticated session rather than prompting for login —
  couldn't do interactive/browser auth from this environment.
- OpenClaw/Crestodian needs to be restarted (or at least have its shell
  re-source `.bashrc`/nvm) to pick up the new PATH — it was checked before
  the CLI was installed.
- `npm install -g` reported one package (`@anthropic-ai/claude-code`) has a
  postinstall script pending approval (`npm warn allow-scripts`). Not acted
  on; run `npm approve-scripts --allow-scripts-pending` to review it if
  something related still doesn't work.
