# BSL facts measured in this project (Bonezegei v1.3.3 and v1.3.4, Windows)

Each line was tested with a small probe script or the API test on 2026-11-23/24. The project now runs on v1.3.4 (build v1.3.4a, x86 installer from the Microsoft Store). Re-test before relying on anything not listed.

## Memory bug (the main cause of crashes)

| Fact | Consequence |
|---|---|
| The GC can free a **temporary nested in a call's arguments** (e.g. `json(c, s, {peers: roomPeers(room)})`) or a value **returned straight from `substr()`**. Symptoms: a segfault after about 30–50 requests (no output), or a string that reads as garbage bytes (on 1.3.4 the `X-Nonce` header came back garbled about 1 in 50 requests). 1.3.4 triggers this more often than 1.3.3. | Build every argument and every return value in a local first: `var reply = {...}; json(c, s, reply);` and `var v = substr(...); return v;`. Applied throughout `server.bzg` (Task 1). |
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
| `x.type` is **built in**: it returns the value's type name (`"object"`), never a JSON field called `type`. | The request field is `kind`. Never read a field named `type` (or other built-in names) with dot access. |
| **No function hoisting**: a function must be defined above its first call at run time ("Undefined variable f"). | Helpers sit below their dependencies in `server.bzg`. |
| `parseJSON` turns surrogate-pair escapes (`😀`) into CESU-8, which is invalid UTF-8. | The browser sends chat as `encodeURIComponent(text)` and decodes it on receive. |

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
| When the headers arrive in their own TCP segment, the bytes after them in the buffer are the **previous request's body**. With same-length requests that is a complete JSON object with an old nonce. | A complete body whose nonce was already used is treated as stale, and the server reads again. Only a never-seen nonce that doesn't match `X-Nonce` is rejected at once. |
| A second `socket_read` on a closed peer returns the same stale buffer (no error). | Never loop on reads; at most one retry, validated by nonce. Nonces are de-duplicated (`seenNonce`). |
| `socket_accept` and `socket_read` block; there is no timeout or non-blocking mode. | An idle browser pre-connect can stall the server until that browser sends a request. |
| On Windows the bind succeeds even when another process already listens on the port (both get `LISTENING`); requests may go to the other app. | Port is configurable; check `netstat -ano` first. |
| A bonezegei process blocked in accept/read may ignore SIGTERM from Git Bash `timeout`. | Test scripts use `timeout -k 5 N bonezegei server.bzg`. |

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
