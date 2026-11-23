# BSL facts measured in this project (Bonezegei v1.3.3, Windows)

Each line was tested with a small probe script on 2026-11-23. Re-test before relying on anything not listed.
These are the evidence for `GAPS.md`.

## Language traps (these caused real bugs)

| Fact | Consequence |
|---|---|
| An object compares **equal to `0` and to `null`** (`{a:1} == null` is 1). | Never write `x == null` / `x == 0` to test "not found". Use `isObject(x)` in `server.bzg` (it checks `stringifyJSON(x)[0] == "{"`). |
| `&&` and `\|\|` do **not short-circuit**. `sizeof(v) > 0 && v[0] == " "` crashes on an empty string. | Nest `if`s instead. |
| String `<` / `>` is an error ("Invalid op on string"). | Compare characters against a lookup string with `indexOf`. |
| `o["key"]` with a string key is an error. Only `o.key` works. | Maps are arrays of objects searched linearly. |
| `toHex(n)` is **not** a global function. | Use decimal digits. |
| Missing property prints `Undefined property x` and yields `0`; execution continues. | Clients must always send every field. |
| `print()` output is buffered; on a segfault the log is lost. | Debug crashes with `writeFile("debug.log", ...)` after each step. |
| `for (var i ...)` inside a function is function-scoped (safe to nest calls). | — |
| Booleans serialize as `1`/`0` in `stringifyJSON`. | Client checks `=== 1`. |

## String size limits

| Fact | Consequence |
|---|---|
| `a + b` truncates the result at ~8212 bytes, and **segfaults** when an operand is ~9000+ bytes. | Never concatenate large strings. Write headers and body with separate `socket_write` calls; slice bodies with `substr` (4096-byte chunks). |
| `readFile`, `substr`, `stringifyJSON` handle 30 KB fine. | Static files and big poll responses are OK if not concatenated. |
| `parseJSON` fails on any **string value longer than ~4096 chars** ("Unterminated string at offset 4101"). | Browser splits SDP into 900-char chunks (`sendSignal` in `public/app.js`). |

## BSL_Socket behaviour

| Fact | Consequence |
|---|---|
| `socket_read(c, n)` does **one `recv()`** into a reused buffer and returns the string up to the old terminator, so **stale bytes from an earlier request can follow** the new data. The size argument seems ignored. | Cut the request at the first `\r\n\r\n` and by `Content-Length`. POST bodies must echo the `X-Nonce` header (`tryBody`). |
| A second `socket_read` on a closed peer returns the same stale buffer (no error). | Never loop on reads; at most one retry, validated by nonce. Nonces are de-duplicated (`seenNonce`). |
| `socket_accept` and `socket_read` block; there is no timeout or non-blocking mode. | An idle browser pre-connect can stall the server until that browser sends a request. |
| On Windows the bind succeeds even when another process already listens on the port (both get `LISTENING`); requests may go to the other app. | Port is configurable; check `netstat -ano` first. |

## Packages (`bzg -list`)

| Package | What it really offers | Relevance |
|---|---|---|
| `socket` | TCP server/client (no TLS). | Used. |
| `https` | **Server only** (`createHTTPSServer`). No outbound HTTPS client. | Server still cannot call Google/GitHub/Facebook APIs → token exchange/verification impossible. |
| `base64` | `base64().encode(s, isHex)`, `.decode(s)`. | Used to decode the Google ID-token payload. |
| `time` | `time().now()` = epoch seconds (float). | Used for token `exp`. |
| `rng` | `rng().seed(n)`, `.randint(a, b)`. Not cryptographic. | Session tokens (seeded with clock; weak, documented). |
| `hash` | DLL contains sha1/sha256/hmac, but `hash().sha256()` is not exposed that way; API unknown. | Not used. |
| `thread`, `http` (has WebSocket) | Exist. | Not used: owner chose polling + single thread. Mention in GAPS as "possible, not used by design". |
