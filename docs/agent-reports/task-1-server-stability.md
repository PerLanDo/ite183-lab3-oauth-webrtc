# Task 1 report: server stability

Branch: agent/server-stability   Last commit: (see `git log -1` on the branch)

Started by the Task 1 agent, finished by the integrator (Claude, main session) after the agent hit its usage limit.

## Root causes and fixes

| # | Symptom | Root cause | Fix (server.bzg unless noted) |
|---|---|---|---|
| 1 | Server segfaults after about 30–50 polls, with no error output | BSL interpreter bug: temporary values nested inside call arguments (e.g. `json(c, s, {peers: roomPeers(room)})`) are freed too early. Raw sockets alone and the interpreter alone were both stable, so the bug is in the interaction. | Every reply object and every nested value is built in a local variable first: `json()` l.170, `fail()` l.175, `createSession()` l.209, `pushMessage()` l.243, new helpers `signedIn()` l.268 and `joinedReply()` l.274, plus `/poll`, `/config`, `/me`, `/send`, `/leave`, `/logout`. 300 polls in a row passed afterwards. |
| 2 | Every `/send` rejected as unknown type | In BSL, `x.type` is built in and always returns the value's type name (`"object"`), never the JSON field. | The request field is now `kind` (`sendMessage()` l.460–467), in both server and `public/app.js`. Poll messages still carry `type` (written by an object literal, which serializes fine). |
| 3 | Emoji arrive as invalid UTF-8 | BSL turns surrogate pairs (`😀`) into CESU-8. | `public/app.js` sends chat as `encodeURIComponent(text)` and decodes it on receive. Encoded text is limited to 2000 characters. |
| 4 | A body whose `nonce` doesn't match `X-Nonce` makes the server wait about 5 s | It fell through to a second `socket_read`, which blocks (no timeouts in BSL). | New `bodyNonce()` (after `tryBody()`): a complete JSON body whose nonce the server has never seen is rejected at once with 400. Only an incomplete body triggers the second read, which is parsed from offset 0. |
| 4b | About 1 in 70 same-size sends (900-char signal chunks) rejected with "body does not match X-Nonce" | When the headers arrive in their own TCP segment, the reused recv buffer still holds the previous request's body right after them. With same-length requests that leftover is a complete JSON object with an old nonce, so fix 4 rejected it as a mismatch. | A complete body whose nonce was already used (`seenNonce()` returns 1) is treated as stale bytes, and the server does the second read. 100 of 100 sends passed afterwards. |
| 5 | (Agent's draft) retry guard `sizeof(bodyText) < cl` | Stale trailing bytes in BSL's reused recv buffer pad the length, so split bodies (large Google credentials) would never be re-read. | Replaced by fix 4. |
| 6 | "Undefined variable publicMe" after adding helpers | BSL has no function hoisting. | Helpers are defined after their dependencies (`publicMe`, `roomPeers`). |

### Test changes (`tests/api_test.sh`)
- Bodies are built with node, with the nonce at the root and non-ASCII escaped as `\uXXXX` (as `asciiJSON` in app.js does), because Windows mangles raw UTF-8 in argv. Git Bash collapses `\\`, so the backslash is `String.fromCharCode(92)`.
- `curl --http1.0 -m 5 -H "Connection: close"`: one request per connection, and a test can never hang.
- Request field renamed to `kind`.
- Extra checks, counted separately so the main total stays 29: emoji round-trip, `<script>` text round-trip, 50 rapid polls, the server survives an idle client, and an idle peer is dropped after 15 s.
- After the idle section, Carol rejoins r2 and A rejoins r1. By then both have been idle for more than 15 s, so the server (correctly) dropped them. A poll is not enough, because a dropped user must rejoin.
- `check()` prints everything after the name on failure. Before this, an unquoted empty `$(...)` status vanished and the server's reply was hidden, which made the "join the room first" reply look like an empty response.

## Test output

BSL v1.3.3, Windows 11, port 3002, a fresh server for each run (`timeout 150 bonezegei server.bzg`, then `BASE=http://localhost:3002 bash tests/api_test.sh`):

```
== run 1
INFO idle client blocked server for approximately 5s
RESULT pass=29 fail=0
EXTRA fail=0
alive:200
== run 2
INFO idle client blocked server for approximately 5s
RESULT pass=29 fail=0
EXTRA fail=0
alive:200
== run 3
INFO idle client blocked server for approximately 5s
RESULT pass=29 fail=0
EXTRA fail=0
alive:200
```

Also: 300 polls in a row (before fix 1 it crashed after 30–50), and 100 of 100 900-char signal sends (before fix 4b about 1 in 70 failed).

## New BSL facts (to add to docs/bsl-findings.md)
- `x.type` is built in: it returns the type name, never a JSON field called `type`.
- No function hoisting: a function must be defined above its first call at run time.
- The GC frees temporaries nested in call arguments, so nested calls build up a crash after repeated requests. Use locals.
- Surrogate-pair `\u` escapes become CESU-8 (invalid UTF-8).
- `toHex()` is not a global.
- On Windows, two processes can bind the same port, so requests may go to either. Check `netstat -ano` before testing.

## Not checked / open
- No real-browser test yet (that is Task 2).
- An idle client that opens a connection and sends nothing blocks the server for about 5 s, because BSL's `socket_read` has no timeout. This is a documented BSL limit; no fix is possible in strict BSL.
- `public/app.js` was edited outside Task 1's file ownership (the `kind` rename and URI-encoded chat), because the server fix needs it. Task 2 should review it.
- PID 36440 (an old integrator debug server) still listens on port 3001, and the owner needs to stop it. Tests for this task used port 3002 (local `config.json`, not committed).
