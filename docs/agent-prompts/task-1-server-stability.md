# Task 1: Make the BSL server pass the API test (wave 1)

- **Branch:** `agent/server-stability` (from `main`)
- **You own:** `server.bzg`, `tests/api_test.sh`. Read anything else; edit nothing else.
- **Report:** `docs/agent-reports/task-1-server-stability.md`

## Context

Read `AGENTS.md`, `docs/decisions.md`, `docs/bsl-findings.md` first. `server.bzg` is a complete first draft: static files, `/config`, `/auth/{google,facebook,dev}`, `/me`, `/join`, `/send`, `/poll`, `/leave`, `/logout`, and a 501 page for `/auth/github`.

State on 2026-11-23 (port 3001, `devLogin: 1`):
- Already fixed: object `== 0` / `== null` checks (now `isObject`), `toHex` (now decimal digits).
- `tests/api_test.sh`: the first 5 checks pass (static files byte-identical, `/config`, 401 on poll without login).
- **Open bug:** the server **segfaults (exit 139)** during the run, after the dev logins start. `server.log` is empty because `print` is buffered.

## Steps

1. Setup as in `AGENTS.md`. Confirm port 3001 is free: `netstat -ano | grep :3001`.
2. Start `bonezegei server.bzg`, run `BASE=http://localhost:3001 bash tests/api_test.sh`. Record the output.
3. Find the crash. Use `writeFile("debug.log", ...)` breadcrumbs (print is lost on segfault) or replay single requests with curl. Suspects, in order:
   - a `+` concatenation with a large operand (see bsl-findings: segfault above ~9 KB), e.g. on the stale `socket_read` buffer;
   - `substr` past the end of a string; indexing an empty string;
   - `rand.randint` with large bounds; `parseJSON` on garbage.
4. Fix with the smallest change. Keep the existing design (polling, nonce check, chunked writes). Add a one-line comment for each BSL workaround.
5. Repeat until `tests/api_test.sh` prints `RESULT pass=29 fail=0` **twice in a row on a fresh server**, and the server is still running afterwards.
6. Extra checks (add them to `tests/api_test.sh`):
   - a chat message with an emoji and with `<script>` text comes back unchanged in `/poll`;
   - 50 rapid polls in a row do not crash the server;
   - a client that connects and sends nothing for 3 s, then disconnects, does not kill the server (it may stall it; record how long).
7. Remove `debug.log` writes before your last commit.

## Do not

- Don't change the HTTP API shape (paths, JSON fields); `public/app.js` depends on it. If a change is unavoidable, describe it in the report.
- Don't add WebSocket, threads, or any non-BSL code to the server.

## Report format

```
# Task 1 report
Branch: agent/server-stability   Last commit: <hash>
## Root cause(s)
- <cause> -> <fix> (server.bzg:<line>)
## Test output
<paste the final two RESULT runs, plus any FAIL lines>
## New BSL facts found
- <fact, with the probe you used>   (Claude will add these to docs/bsl-findings.md)
## Not checked / open issues
- ...
```
