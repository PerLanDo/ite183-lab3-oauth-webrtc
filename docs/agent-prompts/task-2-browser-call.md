# Task 2: Two-window call and chat test in a real browser (wave 2)

**Start only after Task 1 is merged into `main`** (the owner or Claude will tell you).

- **Branch:** `agent/browser-call` (from `main` after Task 1)
- **You own:** `public/index.html`, `public/app.js`, `public/style.css`, and new files under `docs/screenshots/`. Read anything else; edit nothing else.
- **Report:** `docs/agent-reports/task-2-browser-call.md`

## Context

Read `AGENTS.md`, `docs/decisions.md`, `docs/bsl-findings.md`. The client (`public/app.js`) signs in, joins a room, polls `/poll` every 500 ms, sends SDP/ICE in 900-char chunks through `/send`, and falls back to a canvas test pattern when no camera exists. Use `devLogin` (name-only sign-in) for this task; real Google/Facebook sign-in needs the owner's client IDs and is not part of this task.

## Steps

1. Setup as in `AGENTS.md` (port 3001, `devLogin: 1`). Start the server.
2. Open `http://localhost:3001` in two isolated sessions (normal + incognito, or two browsers). Allow camera/mic if asked. If there is no camera, the test pattern is fine; say so in the report.
3. Window A: dev login "Alice", join room `lab3`. Window B: dev login "Bob", join `lab3`.
4. Check and screenshot (save to `docs/screenshots/`):
   - both windows show the remote video; the state pill says `connected`;
   - chat A→B and B→A both appear on the other side;
   - Mute and Camera off change the remote side (audio silent / video black);
   - Window C (third session) dev login "Carol", joins `other`: sees nothing from `lab3`. Trying to join `lab3` shows "room is full".
   - Hang up in A: B shows "Alice left (hang up)", and A returns to the lobby. A rejoins: the call reconnects.
   - Close B's tab without hanging up: within ~15 s A shows "Bob left (timeout)".
5. Read the browser console in every window. Fix client bugs you find, in your files only. If the bug is in the server, describe it in the report (exact request + response) and don't edit `server.bzg`.
6. Re-run `BASE=http://localhost:3001 bash tests/api_test.sh` after your changes; it must still pass.

## Report format

```
# Task 2 report
Branch: agent/browser-call   Last commit: <hash>   Browser(s): <name + version>
| Check | Result (PASS/FAIL) | Evidence (screenshot file / console line) |
|---|---|---|
| A sees+hears B | | |
| B sees+hears A | | |
| chat A->B | | |
| chat B->A | | |
| mute / camera toggle | | |
| room isolation (Carol) | | |
| room full | | |
| hang up + rejoin | | |
| tab close -> timeout leave | | |
## Bugs fixed (file:line, cause -> fix)
## Server issues found (not fixed)
## Not checked
```
