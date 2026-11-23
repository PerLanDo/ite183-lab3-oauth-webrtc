# Delegated tasks: Lab 3

Integrator: Claude (this folder's main session). Owner: you. Agents work on their own branches; only the integrator merges into `main` after checking the report against the real diff and test output.

| Task | File | Branch | Owns | Wave | Status |
|---|---|---|---|---|---|
| 1. Server passes API test (fix segfault) | `task-1-server-stability.md` | `agent/server-stability` | `server.bzg`, `tests/api_test.sh` | 1 | **done**, merged into main 2026-11-24 (29/29 on BSL 1.3.4, report in `docs/agent-reports/`) |
| 3. README, GAPS, TESTING | `task-3-docs.md` | `agent/docs` | `README.md`, `GAPS.md`, `TESTING.md` | 1 | ready (not started) |
| 2. Two-window browser call + chat | `task-2-browser-call.md` | `agent/browser-call` | `public/*`, `docs/screenshots/` | 2 (after Task 1 merged) | ready. Note: Task 1 changed `public/app.js` (`kind` field, URI-encoded chat); review it. |

Tasks 1 and 3 touch different files and can run at the same time. Task 2 needs a working server.

## Prompt to paste into each agent

```
Read docs/agent-prompts/task-1-server-stability.md in this folder and follow its instructions exactly. Read AGENTS.md first.
```
(Change the file name for Tasks 3 and 2.)

When an agent finishes, tell the integrator "task N done". Reports land in `docs/agent-reports/`.

## Owner-only steps (agents must not do these)

- Create the Google OAuth Web client and the Meta app (steps in `task-3-docs.md`), then put the IDs in your local `config.json`.
- Sign in with your real Google/Facebook accounts for the final test.
- Decide whether a minimal non-BSL helper is allowed for GitHub/token verification (decision #7). Default: no.
- Create the GitHub repo and share it with your instructor (due 2026-11-29).
