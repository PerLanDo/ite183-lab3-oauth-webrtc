# GAPS: what strict BSL could not do

This lab's server must be written only in Bonezegei Scripting Language (BSL), with no Node, Python or other helper. This file lists everything that rule prevented or weakened, why, and what would fix it. Measured BSL limits are in [docs/bsl-findings.md](docs/bsl-findings.md). Tested with BSL v1.3.3 and v1.3.4 on Windows 11.

No non-BSL helper was added. Adding one is the owner's decision (decision #7 in `docs/decisions.md`). **Current status: not allowed.**

## Google sign-in: ID-token signature not verified

- **Wanted:** check that the Google ID token was really signed by Google.
- **Why BSL can't:** the token is signed with RS256. Checking it needs RSA and Google's public keys from `https://www.googleapis.com/oauth2/v3/certs`. BSL has no RSA function, and its `https` package is **server-only**, with no outbound HTTPS client to fetch the keys (docs/bsl-findings.md, "Packages": `https`).
- **What the server does instead:** decodes the token's payload (base64url + JSON) and checks `aud` (must equal `googleClientId`), `iss` (`accounts.google.com`) and `exp` (`server.bzg`, `googleSignIn()`). A forged token with the right claims would be accepted. The README labels this "unverified identity, lab demo only".
- **Fix:** a minimal HTTPS helper that verifies the token (or calls Google's `tokeninfo` endpoint), which needs the owner's approval. Alternatively, a future BSL with an HTTPS client and RSA.

## Facebook sign-in: access token not verified

- **Wanted:** check the Facebook access token and read the user's name from Facebook.
- **Why BSL can't:** that needs an HTTPS request to `graph.facebook.com` from the server. BSL has no outbound HTTPS client.
- **What the server does instead:** accepts the name and user ID the browser sends after the Facebook JS SDK login, if both are present (`server.bzg`, `facebookSignIn()`). Anyone could claim any name. It's labelled "unverified identity, lab demo only".
- **Plain HTTP:** Facebook may refuse the JS SDK login on `http://` pages. **Not yet tested:** it needs the owner's Meta app ID.
- **Fix:** the same minimal HTTPS helper, with owner approval.

## GitHub sign-in

- **Wanted:** "Sign in with GitHub".
- **Why BSL can't:** GitHub's OAuth web flow returns a `code`. That code must be exchanged for a token by an **HTTPS POST to `github.com/login/oauth/access_token` that includes the client secret**. The exchange can't be done in the browser: the secret must not be shipped to the browser, and GitHub's token endpoint doesn't allow cross-origin browser calls (no CORS). The BSL server can't make the HTTPS request either. There is no browser-only flow for GitHub sign-in.
- **What the app does instead:** the GitHub button is disabled with an explanation. `GET /auth/github` returns `501 Not Implemented` with the reason (checked by `tests/api_test.sh`).
- **Fix:** a minimal HTTPS helper that does the code exchange and keeps the client secret out of git, with owner approval.

## Session tokens are not cryptographically random

- **Wanted:** unguessable session tokens.
- **Why BSL can't:** the only random source is the `rng` package (`randint`), which is not cryptographic and is seeded from the clock (docs/bsl-findings.md, "Packages": `rng`). There is no access to the OS random generator.
- **What the server does:** builds each token from four 9-digit `randint` values (`server.bzg`, `newToken()`). That's fine for a local lab, but not secure.
- **Fix:** a crypto-random source in BSL (e.g. Windows `BCryptGenRandom`).

## No TLS for the app itself

- The app runs on `http://localhost` only (decision #2). The `https` package could serve HTTPS, but it needs a certificate, and the brief asks for localhost.
- Browsers treat `http://localhost` as a secure context, so the camera, microphone and WebRTC still work. They would **not** work on plain HTTP from another computer.

## Socket limits (BSL_Socket)

Evidence: docs/bsl-findings.md, "BSL_Socket behaviour".

| Limit | Effect on this app | Workaround in `server.bzg` |
|---|---|---|
| `socket_read` does one `recv()` into a reused buffer and returns stale bytes from earlier requests after the new data. | Requests can look longer than they are; a body that arrives later is hidden behind old bytes. | Requests are cut by `\r\n\r\n` and `Content-Length`. Each POST body repeats its `X-Nonce` header as `nonce`; a body whose nonce was already used is treated as stale, and the server reads once more. |
| No read or accept timeouts; one connection at a time (no threads, decision #4). | A client that connects and sends nothing blocks the whole server for about 5 s (measured), until that client times out. | None possible in strict BSL. The browser's 500 ms polling recovers on its own. |
| On Windows, a second program can bind the same port. | Requests can reach the wrong program. | Port is configurable; check `netstat -ano`. |

## String and memory limits

| Limit | Effect | Workaround |
|---|---|---|
| `a + b` cuts the result off at about 8 KB and crashes when a part is about 9 KB or more. | Large responses can't be built by concatenation. | Headers and body are written separately; bodies are sent in 4096-byte slices. |
| `parseJSON` fails on string values longer than about 4096 characters. | A WebRTC offer (SDP) can be longer. | The browser splits signaling into 900-character chunks; the server limits POST bodies to 4000 bytes. |
| The garbage collector can free values nested in a call's arguments or returned straight from `substr()`. | Segfaults after about 30–50 requests, or garbled header values (worse on 1.3.4). | Every value is built in a local variable first. See `docs/agent-reports/task-1-server-stability.md`. |
| `parseJSON` turns emoji (surrogate pairs) into invalid UTF-8 (CESU-8). | Emoji in chat would arrive broken. | The browser URI-encodes chat text and decodes it on receive. |

## WebSocket: possible, but not used

BSL's `http` package includes WebSocket support, and `base64` and `hash` exist. The owner chose short polling instead (decision #3), so WebSocket was not used. This is a design choice, not a BSL limit.

## No ICE servers

Not a BSL limit: the brief asks for none (decision #5). Without STUN/TURN, calls work only on one machine or one LAN.
