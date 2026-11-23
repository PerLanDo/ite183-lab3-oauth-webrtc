# Rules for every agent working in this folder

Project: ITE183 Lab 3. Sign-in + 1:1 WebRTC video call + room chat. Server in Bonezegei Scripting Language (BSL).
Read `docs/decisions.md` (owner decisions) and `docs/bsl-findings.md` (measured BSL limits) before changing anything.

## Never break

1. Server code is BSL only (`server.bzg`). Browser code is vanilla HTML/CSS/JS in `public/`. No Node/Python/frameworks/Firebase in the app. (Test scripts in `tests/` may use bash, curl and node.)
2. Short polling, not WebSocket. One connection at a time. No ICE servers.
3. No non-BSL helper or proxy. If a provider can't work, write it in `GAPS.md` and report it; don't work around it.
4. No secrets in git. `config.json` is git-ignored; edit only `config.example.json` in commits.
5. Never type passwords, client secrets or provider-console steps for the owner. Stop and report instead.
6. Don't stop or kill processes you didn't start. Port 3000 on this PC is used by another app and 3001 by an old debug server (until the owner stops it); test on **3002** (`"port": 3002` in your local `config.json`).

## How to work

- Work only in **your own git branch** (name given in your task file), created from `main`. Prefer a separate worktree: `git worktree add ../lab3-<task> -b <branch>`.
- Touch only the files your task file says you own. If you need a change elsewhere, write it in your report instead.
- Setup: `bzg install` (creates `lib/`), `cp config.example.json config.json`, set `"port": 3002` and `"devLogin": 1` locally.
- Run: `bonezegei server.bzg`. Test: `BASE=http://localhost:3002 bash tests/api_test.sh`.
- Commit small steps on your branch with clear messages. Don't merge to `main`, don't push unless your task file says so.
- Never claim something works unless you ran it. Quote real output.
- Finish by writing your report to `docs/agent-reports/<task-id>.md` in the format your task file gives.
